# SES Runbook (Production)

## Goal

Enable verification emails from API via AWS SES using ECS task role.

## Infra resources

Terraform now defines:
- `aws_ses_domain_identity` for `zinovia.ai`
- DKIM via `aws_ses_domain_dkim` + Route53 DKIM records
- MAIL FROM domain `mail.zinovia.ai` via `aws_ses_domain_mail_from`
- Route53 records for SES verification, DKIM, and MAIL FROM
- ECS task role policy for SES send actions

## Required API env

- `MAIL_PROVIDER=ses`
- `MAIL_FROM=noreply@zinovia.ai`
- `PUBLIC_WEB_BASE_URL=https://zinovia.ai`
- `AWS_REGION=us-east-1`

## SES prerequisites

1. Verify domain identity (`zinovia.ai`) in SES.
2. Ensure DKIM records are published.
3. Move SES account out of sandbox for unrestricted delivery.
4. Verify `MAIL_FROM` behavior and SPF alignment.

## IAM permissions (ECS task role)

- `ses:SendEmail`
- `ses:SendRawEmail`
- `ses:GetAccount`
- `ses:SendTemplatedEmail`

## Verification steps

1. Apply Terraform.
2. Redeploy API tasks.
3. Trigger signup in production.
4. Check API logs:
   - Success path includes verification send event.
   - Failure path logs `verification email delivery failed` with request id.

CloudWatch (example):
- Log group: `/ecs/zinovia-fans-prod-api`
- Query/filter: `verification email`

## Console locations

- SES identities:
  - AWS Console → Amazon SES → Verified identities
- SES account status/sandbox:
  - AWS Console → Amazon SES → Account dashboard
- Route53 records:
  - AWS Console → Route53 → Hosted zone `zinovia.ai`
