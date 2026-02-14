resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-rds-subnet"
  subnet_ids = var.subnet_ids
  tags       = { Name = "${var.name_prefix}-rds-subnet" }

  # When replacing (staging→prod), create new subnet group before destroying old so RDS can migrate
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "main" {
  identifier        = "${var.name_prefix}-postgres"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  multi_az          = var.multi_az

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible    = false

  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection = var.deletion_protection
  skip_final_snapshot = !var.deletion_protection
  storage_encrypted   = true

  tags = { Name = "${var.name_prefix}-postgres" }
}
