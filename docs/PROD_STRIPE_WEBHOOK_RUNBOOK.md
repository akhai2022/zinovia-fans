# Production Stripe Webhook Runbook (ECS + ALB)

This runbook prepares and validates Stripe webhooks for PPV Message Unlocks at:

- `https://api.zinovia.ai/webhooks/stripe`

It assumes Terraform lives in `infra/aws/terraform` and production values in `infra/aws/terraform/env/prod.tfvars`.

## 1) Apply Order (safe, minimal-drift)

1. **Routing and emergency HTTP mode (optional)**
   - Keep `force_http_forwarding = false` for normal production.
   - Set `force_http_forwarding = true` only for temporary validation if HTTPS is blocked.
2. **ACM validation + HTTPS listener**
   - Ensure `enable_acm = true`, `enable_route53 = true`, `dns_delegated = true`.
   - Keep `wait_for_certificate_validation = true` so HTTPS listener binds only after cert validation.
3. **Secrets and ECS**
   - Ensure API task has `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` injected via ECS `secrets`.
   - Update secret values in Secrets Manager out-of-band (CLI or console), not in Terraform state.
4. **Deploy API**
   - Force ECS API deployment so task picks up latest secret versions.

## 2) Terraform Commands (prod)

```bash
cd /home/akhai/workspace/zinovia-fans

terraform -chdir=infra/aws/terraform init

terraform -chdir=infra/aws/terraform plan \
  -var-file=env/prod.tfvars

terraform -chdir=infra/aws/terraform apply \
  -var-file=env/prod.tfvars
```

Optional emergency HTTP mode (temporary only):

```bash
terraform -chdir=infra/aws/terraform apply \
  -var-file=env/prod.tfvars \
  -var='force_http_forwarding=true'
```

## 3) Import Existing Resources (avoid ResourceExistsException)

Use these placeholders for environments where resources already exist.

### Secrets Manager (required)

```bash
terraform -chdir=infra/aws/terraform import \
  'module.secrets.aws_secretsmanager_secret.jwt_secret' \
  '<secret-arn-or-name>'

terraform -chdir=infra/aws/terraform import \
  'module.secrets.aws_secretsmanager_secret.csrf_secret' \
  '<secret-arn-or-name>'

terraform -chdir=infra/aws/terraform import \
  'module.secrets.aws_secretsmanager_secret.stripe_secret_key' \
  '<secret-arn-or-name>'

terraform -chdir=infra/aws/terraform import \
  'module.secrets.aws_secretsmanager_secret.stripe_webhook_secret' \
  '<secret-arn-or-name>'
```

Optional (if you want Terraform to track current secret versions):

```bash
# format: <secret-arn>|<version-id>
terraform -chdir=infra/aws/terraform import \
  'module.secrets.aws_secretsmanager_secret_version.stripe_secret_key' \
  '<secret-arn>|<version-id>'

terraform -chdir=infra/aws/terraform import \
  'module.secrets.aws_secretsmanager_secret_version.stripe_webhook_secret' \
  '<secret-arn>|<version-id>'
```

### ALB / Target Groups / Listeners (if pre-existing)

```bash
terraform -chdir=infra/aws/terraform import \
  'aws_lb.main[0]' \
  '<alb-arn>'

terraform -chdir=infra/aws/terraform import \
  'aws_lb_target_group.api[0]' \
  '<api-target-group-arn>'

terraform -chdir=infra/aws/terraform import \
  'aws_lb_target_group.web[0]' \
  '<web-target-group-arn>'

terraform -chdir=infra/aws/terraform import \
  'aws_lb_listener.https[0]' \
  '<https-listener-arn>'

terraform -chdir=infra/aws/terraform import \
  'aws_lb_listener.http[0]' \
  '<http-listener-arn>'
```

### ACM certificate (if already requested)

```bash
terraform -chdir=infra/aws/terraform import \
  'module.acm_alb[0].aws_acm_certificate.cert' \
  '<acm-certificate-arn>'
```

## 4) Set Stripe Secret Values (out-of-band)

Avoid storing real secret values in Terraform vars/state.

```bash
aws secretsmanager put-secret-value \
  --region us-east-1 \
  --secret-id '<zinovia-fans-prod-stripe-secret-key>' \
  --secret-string '<sk_live_value>'

aws secretsmanager put-secret-value \
  --region us-east-1 \
  --secret-id '<zinovia-fans-prod-stripe-webhook-secret>' \
  --secret-string '<whsec_value_from_stripe>'
```

Then force API rollout:

```bash
AWS_REGION=$(terraform -chdir=infra/aws/terraform output -raw aws_region)
CLUSTER=$(terraform -chdir=infra/aws/terraform output -raw ecs_cluster_name)
API_SERVICE=$(terraform -chdir=infra/aws/terraform output -raw ecs_api_service_name)

aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER" \
  --service "$API_SERVICE" \
  --force-new-deployment
```

## 5) Verification

### Public routing and endpoint

```bash
curl -i https://api.zinovia.ai/health
curl -i https://api.zinovia.ai/webhooks/stripe
```

Expected:
- `/health` => `200`
- `/webhooks/stripe` => `400` or `405` on non-Stripe request, **not** `404`

### Stripe dashboard

1. In Stripe, set webhook endpoint:
   - `https://api.zinovia.ai/webhooks/stripe`
2. Send a test event (`payment_intent.succeeded`).
3. Confirm Stripe reports `2xx`.

### Database confirmation

Confirm event idempotency row is stored (using your DB access method):

```sql
SELECT event_id, event_type, received_at, processed_at
FROM stripe_events
ORDER BY received_at DESC
LIMIT 20;
```

## 6) AWS CLI Checks

```bash
aws elbv2 describe-listeners \
  --load-balancer-arn <alb-arn>

aws elbv2 describe-rules \
  --listener-arn <https-listener-arn>

aws secretsmanager get-secret-value \
  --secret-id <zinovia-fans-prod-stripe-webhook-secret> \
  --region us-east-1

aws logs tail /ecs/zinovia-fans-prod-api \
  --since 15m \
  --region us-east-1
```

## 7) Rollback

1. Disable emergency forwarding after validation:

```bash
terraform -chdir=infra/aws/terraform apply \
  -var-file=env/prod.tfvars \
  -var='force_http_forwarding=false'
```

2. If listener routing needs emergency rollback:
   - Revert Terraform commit that changed listener rules.
   - Re-apply `prod.tfvars`.
3. If webhook secret is wrong:
   - Put prior value back with `aws secretsmanager put-secret-value`.
   - Force API new deployment.

