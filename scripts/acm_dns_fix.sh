#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-zinovia.ai}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AUTHORITATIVE_AI_NS="${AUTHORITATIVE_AI_NS:-v0n2.nic.ai}"
POLL_SECONDS="${POLL_SECONDS:-15}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-1200}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing required command: $1" >&2
    exit 1
  }
}

for c in aws jq dig sort tr sed awk date; do
  need_cmd "$c"
done

echo "=== Step 1: AWS identity, region, hosted zones matching ${DOMAIN} ==="
echo "AWS caller identity:"
aws sts get-caller-identity --output json | jq .

echo
echo "Configured default region (reference):"
aws configure get region || true
echo "Runbook region (forced): ${AWS_REGION}"

echo
echo "Hosted zones containing ${DOMAIN}:"
aws route53 list-hosted-zones --output json \
| jq -r --arg d "$DOMAIN" '
  .HostedZones[]
  | select(.Name | test($d + "\\.$") or test("\\." + $d + "\\.$"))
  | [
      (.Id | sub("^/hostedzone/"; "")),
      .Name,
      (if .Config.PrivateZone then "private" else "public" end)
    ]
  | @tsv
' \
| awk 'BEGIN{print "ZONE_ID\tNAME\tTYPE"} {print}'

echo
echo "=== Step 2: Pending ACM certs in ${AWS_REGION} + validation records ==="
mapfile -t PENDING_ARNS < <(
  aws acm list-certificates \
    --region "${AWS_REGION}" \
    --certificate-statuses PENDING_VALIDATION \
    --output json \
  | jq -r '.CertificateSummaryList[].CertificateArn'
)

if ((${#PENDING_ARNS[@]} == 0)); then
  echo "No PENDING_VALIDATION certs in ${AWS_REGION}."
  exit 0
fi

echo "Found ${#PENDING_ARNS[@]} pending cert(s)."
TMP_RECORDS="$(mktemp)"
: > "${TMP_RECORDS}"

printf "CERT_ARN\tCERT_DOMAIN\tVALIDATION_DOMAIN\tRR_NAME\tRR_TYPE\tRR_VALUE\tVALIDATION_STATUS\n"
for arn in "${PENDING_ARNS[@]}"; do
  aws acm describe-certificate --region "${AWS_REGION}" --certificate-arn "${arn}" --output json \
  | jq -r --arg arn "$arn" '
      .Certificate as $c
      | $c.DomainValidationOptions[]
      | select(.ResourceRecord != null)
      | [
          $arn,
          $c.DomainName,
          .DomainName,
          .ResourceRecord.Name,
          .ResourceRecord.Type,
          .ResourceRecord.Value,
          .ValidationStatus
        ]
      | @tsv
    ' \
  | tee -a "${TMP_RECORDS}"
done

echo
echo "=== Step 3: Identify the correct public hosted zone for ${DOMAIN} ==="
mapfile -t CANDIDATE_ZONE_IDS < <(
  aws route53 list-hosted-zones-by-name \
    --dns-name "${DOMAIN}" \
    --max-items 20 \
    --output json \
  | jq -r --arg d "${DOMAIN}." '
      .HostedZones[]
      | select(.Name == $d and .Config.PrivateZone == false)
      | (.Id | sub("^/hostedzone/"; ""))
    '
)

if ((${#CANDIDATE_ZONE_IDS[@]} == 0)); then
  echo "ERROR: no public hosted zone named ${DOMAIN}."
  exit 1
fi

echo "Public zone candidate IDs: ${CANDIDATE_ZONE_IDS[*]}"
echo
echo "Parent delegation NS via ${AUTHORITATIVE_AI_NS}:"
PARENT_NS="$(dig +short NS "${DOMAIN}" @"${AUTHORITATIVE_AI_NS}" | sed 's/\.$//' | sort || true)"
if [[ -z "${PARENT_NS}" ]]; then
  echo "WARNING: could not read NS from ${AUTHORITATIVE_AI_NS}"
else
  echo "${PARENT_NS}" | sed 's/^/  - /'
fi

ZONE_ID=""
for zid in "${CANDIDATE_ZONE_IDS[@]}"; do
  ZONE_NS="$(aws route53 get-hosted-zone --id "${zid}" --output json | jq -r '.DelegationSet.NameServers[]?' | sed 's/\.$//' | sort || true)"
  echo
  echo "Zone ${zid} NS:"
  if [[ -n "${ZONE_NS}" ]]; then
    echo "${ZONE_NS}" | sed 's/^/  - /'
  else
    echo "  (none)"
  fi

  if [[ -n "${PARENT_NS}" && -n "${ZONE_NS}" ]] && diff -u <(echo "${PARENT_NS}") <(echo "${ZONE_NS}") >/dev/null; then
    ZONE_ID="${zid}"
    echo "Matched delegated zone: ${ZONE_ID}"
    break
  fi
done

if [[ -z "${ZONE_ID}" ]]; then
  ZONE_ID="${CANDIDATE_ZONE_IDS[0]}"
  echo "WARNING: no exact NS delegation match; falling back to first candidate zone ${ZONE_ID}"
fi

echo "Using hosted zone ID: ${ZONE_ID}"

echo
echo "=== Step 4: UPSERT each validation CNAME (TTL 300) ==="
TMP_UNIQUE_RECORDS="$(mktemp)"
awk -F'\t' '{print $4 "\t" $5 "\t" $6}' "${TMP_RECORDS}" | sed '/^\t\t$/d' | sort -u > "${TMP_UNIQUE_RECORDS}"

while IFS=$'\t' read -r rr_name rr_type rr_value; do
  [[ -z "${rr_name}" ]] && continue
  change_batch="$(jq -n \
    --arg n "${rr_name}" \
    --arg t "${rr_type}" \
    --arg v "${rr_value}" \
    '{
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: $n,
            Type: $t,
            TTL: 300,
            ResourceRecords: [{Value: $v}]
          }
        }
      ]
    }'
  )"

  echo "UPSERT ${rr_name} ${rr_type} ${rr_value}"
  aws route53 change-resource-record-sets \
    --hosted-zone-id "${ZONE_ID}" \
    --change-batch "${change_batch}" \
    --output json \
  | jq -r '.ChangeInfo | "  change_id=\(.Id) status=\(.Status) submitted=\(.SubmittedAt)"'
done < "${TMP_UNIQUE_RECORDS}"

echo
echo "=== Step 5: Propagation checks ==="
echo "5a) Route53 direct query:"
while IFS=$'\t' read -r rr_name rr_type rr_value; do
  [[ -z "${rr_name}" ]] && continue
  echo "Record: ${rr_name} (${rr_type})"
  aws route53 list-resource-record-sets \
    --hosted-zone-id "${ZONE_ID}" \
    --start-record-name "${rr_name}" \
    --start-record-type "${rr_type}" \
    --max-items 1 \
    --output json \
  | jq -r '.ResourceRecordSets[0] | "  Name=\(.Name) Type=\(.Type) TTL=\(.TTL) Value=\(.ResourceRecords[0].Value)"'
done < "${TMP_UNIQUE_RECORDS}"

echo
echo "5b) dig +trace for CNAME record(s):"
while IFS=$'\t' read -r rr_name rr_type rr_value; do
  [[ -z "${rr_name}" ]] && continue
  echo "dig +trace ${rr_name} CNAME"
  dig +trace "${rr_name}" CNAME | sed 's/^/  /'
done < "${TMP_UNIQUE_RECORDS}"

echo
echo "5c) Authoritative .ai checks against ${AUTHORITATIVE_AI_NS}:"
echo "NS for ${DOMAIN}:"
dig +short NS "${DOMAIN}" @"${AUTHORITATIVE_AI_NS}" | sed 's/^/  /'
while IFS=$'\t' read -r rr_name rr_type rr_value; do
  [[ -z "${rr_name}" ]] && continue
  echo "${rr_name} CNAME @${AUTHORITATIVE_AI_NS}:"
  dig +short "${rr_name}" CNAME @"${AUTHORITATIVE_AI_NS}" | sed 's/^/  /'
done < "${TMP_UNIQUE_RECORDS}"

echo
echo "=== Step 6: Wait up to ~20m for certs to become ISSUED (every ${POLL_SECONDS}s) ==="
START_EPOCH="$(date +%s)"
DEADLINE_EPOCH=$((START_EPOCH + MAX_WAIT_SECONDS))
ALL_ISSUED=false

while true; do
  now="$(date +%s)"
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  pending_count=0

  echo "[${ts}] Status snapshot:"
  for arn in "${PENDING_ARNS[@]}"; do
    status="$(
      aws acm describe-certificate \
        --region "${AWS_REGION}" \
        --certificate-arn "${arn}" \
        --output json \
      | jq -r '.Certificate.Status'
    )"
    echo "  ${arn} => ${status}"
    [[ "${status}" != "ISSUED" ]] && pending_count=$((pending_count + 1))
  done

  if ((pending_count == 0)); then
    ALL_ISSUED=true
    break
  fi
  if ((now >= DEADLINE_EPOCH)); then
    break
  fi
  sleep "${POLL_SECONDS}"
done

echo
echo "=== Step 7: Missing records / likely cause (if still pending) ==="
if [[ "${ALL_ISSUED}" == "true" ]]; then
  echo "SUCCESS: all tracked certs are now ISSUED."
  rm -f "${TMP_RECORDS}" "${TMP_UNIQUE_RECORDS}"
  exit 0
fi

echo "Some cert(s) still pending after ${MAX_WAIT_SECONDS}s."
echo "Non-success validations:"
for arn in "${PENDING_ARNS[@]}"; do
  aws acm describe-certificate --region "${AWS_REGION}" --certificate-arn "${arn}" --output json \
  | jq -r --arg arn "${arn}" '
      .Certificate as $c
      | $c.DomainValidationOptions[]
      | select(.ValidationStatus != "SUCCESS")
      | [
          $arn,
          $c.DomainName,
          .DomainName,
          .ValidationStatus,
          (.ResourceRecord.Name // "N/A"),
          (.ResourceRecord.Type // "N/A"),
          (.ResourceRecord.Value // "N/A")
        ]
      | @tsv
    ' \
  | awk -F'\t' '{
      printf "  cert=%s\n    cert_domain=%s\n    validation_domain=%s\n    validation_status=%s\n    required_record=%s %s %s\n",
      $1,$2,$3,$4,$5,$6,$7
    }'
done

echo
echo "Likely causes:"
echo "  1) Wrong hosted zone selected (multiple public zones with same name)."
echo "  2) Delegation mismatch (parent .ai NS does not match Route53 zone NS)."
echo "  3) Delegation not complete at registrar/.ai registry yet."
echo "  4) DNSSEC misconfiguration or SERVFAIL."
echo "  5) Records created in a different AWS account/zone."

echo
echo "Helpful follow-ups:"
echo "  aws route53 get-hosted-zone --id ${ZONE_ID}"
echo "  dig +dnssec ${DOMAIN} NS @${AUTHORITATIVE_AI_NS}"
echo "  aws acm list-certificates --region ${AWS_REGION} --certificate-statuses PENDING_VALIDATION ISSUED"

rm -f "${TMP_RECORDS}" "${TMP_UNIQUE_RECORDS}"
