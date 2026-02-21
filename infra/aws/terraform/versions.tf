terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Use S3 + DynamoDB backend in production; local for initial bootstrap.
  # backend "s3" {
  #   bucket         = "zinovia-fans-terraform-state"
  #   key            = "aws/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "zinovia-fans-terraform-lock"
  #   encrypt        = true
  # }
}
