variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR for VPC"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AZs (e.g. [us-east-1a, us-east-1b])"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "additional_rds_ingress_security_group_ids" {
  type        = list(string)
  default     = []
  description = "Additional security group IDs allowed to access RDS (e.g. other projects sharing this DB)"
}

# Number of NAT gateways (1 for staging/cost, 2+ for prod HA)
variable "nat_gateway_count" {
  type        = number
  default     = 1
  description = "Number of NAT gateways (1 = single AZ NAT, 2 = one per AZ)"
}
