variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for RDS"
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security group IDs for RDS"
}

variable "instance_class" {
  type        = string
  default     = "db.t3.micro"
  description = "RDS instance class"
}

variable "allocated_storage" {
  type        = number
  default     = 20
  description = "Allocated storage in GB (required for aws_db_instance)"
}

variable "multi_az" {
  type        = bool
  default     = false
  description = "Multi-AZ deployment"
}

variable "deletion_protection" {
  type        = bool
  default     = false
  description = "Deletion protection"
}

variable "backup_retention_days" {
  type        = number
  default     = 7
  description = "Backup retention in days"
}

variable "db_name" {
  type        = string
  default     = "zinovia"
  description = "Database name"
}

variable "db_username" {
  type        = string
  default     = "zinovia"
  description = "Master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Master password (from random_password or Secrets Manager)"
}
