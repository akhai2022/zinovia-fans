resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}-db-password"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-db-password" }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.name_prefix}-jwt-secret"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-jwt-secret" }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret != "" ? var.jwt_secret : "CHANGE-ME-set-in-console"
}

resource "aws_secretsmanager_secret" "csrf_secret" {
  name                    = "${var.name_prefix}-csrf-secret"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-csrf-secret" }
}

resource "aws_secretsmanager_secret_version" "csrf_secret" {
  secret_id     = aws_secretsmanager_secret.csrf_secret.id
  secret_string = var.csrf_secret != "" ? var.csrf_secret : "CHANGE-ME-set-in-console"
}

resource "aws_secretsmanager_secret" "stripe_secret_key" {
  name                    = "${var.name_prefix}-stripe-secret-key"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-stripe-secret-key" }
}

resource "aws_secretsmanager_secret_version" "stripe_secret_key" {
  secret_id     = aws_secretsmanager_secret.stripe_secret_key.id
  secret_string = "sk_placeholder"
}

resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name                    = "${var.name_prefix}-stripe-webhook-secret"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-stripe-webhook-secret" }
}

resource "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.stripe_webhook_secret.id
  secret_string = "whsec_placeholder"
}
