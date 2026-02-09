output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}

output "csrf_secret_arn" {
  value = aws_secretsmanager_secret.csrf_secret.arn
}

output "stripe_secret_key_arn" {
  value = aws_secretsmanager_secret.stripe_secret_key.arn
}

output "stripe_webhook_secret_arn" {
  value = aws_secretsmanager_secret.stripe_webhook_secret.arn
}
