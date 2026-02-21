output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}

output "csrf_secret_arn" {
  value = aws_secretsmanager_secret.csrf_secret.arn
}

output "ccbill_salt_arn" {
  value = aws_secretsmanager_secret.ccbill_salt.arn
}

output "ccbill_datalink_password_arn" {
  value = aws_secretsmanager_secret.ccbill_datalink_password.arn
}

output "resend_api_key_arn" {
  value = aws_secretsmanager_secret.resend_api_key.arn
}

output "resend_webhook_secret_arn" {
  value = aws_secretsmanager_secret.resend_webhook_secret.arn
}

output "replicate_api_token_arn" {
  value = aws_secretsmanager_secret.replicate_api_token.arn
}
