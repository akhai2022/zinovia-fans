# Default provider: all regional resources (Secrets Manager, ECS, RDS, S3, ECR, etc.) use this region. Staging = us-east-1.
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "zinovia-fans"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront and ACM for CloudFront require us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "zinovia-fans"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
