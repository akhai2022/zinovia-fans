resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}-db-password"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-db-password" }
  # lifecycle { prevent_destroy = true }  # Uncomment after initial deploy
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.name_prefix}-jwt-secret"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-jwt-secret" }
  # lifecycle { prevent_destroy = true }  # Uncomment after initial deploy
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret != "" ? var.jwt_secret : "CHANGE-ME-set-in-console"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "csrf_secret" {
  name                    = "${var.name_prefix}-csrf-secret"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-csrf-secret" }
  # lifecycle { prevent_destroy = true }  # Uncomment after initial deploy
}

resource "aws_secretsmanager_secret_version" "csrf_secret" {
  secret_id     = aws_secretsmanager_secret.csrf_secret.id
  secret_string = var.csrf_secret != "" ? var.csrf_secret : "CHANGE-ME-set-in-console"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "ccbill_salt" {
  name                    = "${var.name_prefix}-ccbill-salt"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-ccbill-salt" }
}

resource "aws_secretsmanager_secret_version" "ccbill_salt" {
  secret_id     = aws_secretsmanager_secret.ccbill_salt.id
  secret_string = "CHANGE-ME-set-in-console"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "ccbill_datalink_password" {
  name                    = "${var.name_prefix}-ccbill-datalink-password"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-ccbill-datalink-password" }
}

resource "aws_secretsmanager_secret_version" "ccbill_datalink_password" {
  secret_id     = aws_secretsmanager_secret.ccbill_datalink_password.id
  secret_string = "CHANGE-ME-set-in-console"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "resend_api_key" {
  name                    = "${var.name_prefix}-resend-api-key"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-resend-api-key" }
}

resource "aws_secretsmanager_secret_version" "resend_api_key" {
  secret_id     = aws_secretsmanager_secret.resend_api_key.id
  secret_string = var.resend_api_key != "" ? var.resend_api_key : "re_placeholder"
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "replicate_api_token" {
  name                    = "${var.name_prefix}-replicate-api-token"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.name_prefix}-replicate-api-token" }
}

resource "aws_secretsmanager_secret_version" "replicate_api_token" {
  secret_id     = aws_secretsmanager_secret.replicate_api_token.id
  secret_string = "CHANGE-ME-set-in-console"
  lifecycle {
    ignore_changes = [secret_string]
  }
}
