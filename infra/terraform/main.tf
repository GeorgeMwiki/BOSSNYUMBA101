# =============================================================================
# BOSSNYUMBA - Root-level Terraform shim (deprecated)
# =============================================================================
# The canonical infrastructure lives in ../../infrastructure/terraform.
# This file only remains so older CI pipelines referencing infra/terraform
# can continue to `init` without blowing up, by delegating to the staging
# environment via a module reference. New changes should go through
# infrastructure/terraform/environments/{staging,production}.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "BOSSNYUMBA"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Deployment environment (use staging or production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be one of: staging, production."
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "bossnyumba"
}

output "environment" {
  value       = var.environment
  description = "Resolved environment"
}

output "canonical_path" {
  value       = "infrastructure/terraform/environments/${var.environment}"
  description = "Canonical Terraform layout for this environment"
}
