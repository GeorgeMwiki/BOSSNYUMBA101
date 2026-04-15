# =============================================================================
# BOSSNYUMBA - Staging Environment
# =============================================================================
# Usage: terraform init -backend-config=backend.hcl && terraform apply -var-file=staging.tfvars
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure via: terraform init -backend-config=backend.hcl
    # bucket         = "bossnyumba-terraform-state"
    # key            = "staging/terraform.tfstate"
    # region         = "eu-west-1"
    # encrypt        = true
    # dynamodb_table = "bossnyumba-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "BOSSNYUMBA"
      Environment = "staging"
      ManagedBy   = "Terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Core networking + data + compute
# -----------------------------------------------------------------------------
module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  azs                = var.availability_zones
  public_subnets     = var.public_subnet_cidrs
  private_subnets    = var.private_subnet_cidrs
  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.single_nat_gateway
}

module "rds" {
  source = "../../modules/rds"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr           = module.vpc.vpc_cidr
  private_subnet_ids = module.vpc.private_subnet_ids
  instance_class     = var.rds_instance_class
  allocated_storage  = var.rds_allocated_storage
  database_name      = var.rds_database_name
  database_username  = var.rds_username
  database_password  = var.rds_password
  multi_az           = var.rds_multi_az
}

module "redis" {
  source = "../../modules/redis"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = var.redis_node_type
  num_cache_clusters = var.redis_num_cache_clusters
}

module "s3" {
  source = "../../modules/s3"

  project_name         = var.project_name
  environment          = var.environment
  enable_versioning    = false
  use_kms              = false
  cors_allowed_origins = var.s3_cors_allowed_origins
}

module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  environment  = var.environment
}

module "messaging" {
  source = "../../modules/messaging"

  project_name = var.project_name
  environment  = var.environment
}

# -----------------------------------------------------------------------------
# DNS + ACM (optional - requires domain_name)
# -----------------------------------------------------------------------------
module "dns" {
  source = "../../modules/dns"
  count  = var.domain_name == "" ? 0 : 1

  project_name              = var.project_name
  environment               = var.environment
  domain_name               = var.domain_name
  create_zone               = var.create_hosted_zone
  subject_alternative_names = var.san_domains
  alb_alias_names           = var.alb_alias_names
  alb_dns_name              = module.ecs.alb_dns_name
  alb_zone_id               = module.ecs.alb_zone_id
}

module "ecs" {
  source = "../../modules/ecs"

  project_name              = var.project_name
  environment               = var.environment
  vpc_id                    = module.vpc.vpc_id
  public_subnet_ids         = module.vpc.public_subnet_ids
  private_subnet_ids        = module.vpc.private_subnet_ids
  database_url              = module.rds.connection_string
  redis_url                 = module.redis.connection_string
  api_image                 = var.api_image
  api_cpu                   = var.api_cpu
  api_memory                = var.api_memory
  api_desired_count         = var.api_desired_count
  enable_container_insights = var.enable_container_insights
  app_services              = var.app_services
  certificate_arn           = var.domain_name == "" ? "" : module.dns[0].certificate_arn
}

module "waf" {
  source = "../../modules/waf"

  project_name             = var.project_name
  environment              = var.environment
  alb_arn                  = module.ecs.alb_arn
  rate_limit_per_5_minutes = var.waf_rate_limit
}

module "monitoring" {
  source = "../../modules/monitoring"

  project_name               = var.project_name
  environment                = var.environment
  aws_region                 = var.aws_region
  alb_arn_suffix             = module.ecs.alb_arn_suffix
  ecs_cluster_name           = module.ecs.cluster_name
  ecs_service_names          = concat([module.ecs.api_service_name], values(module.ecs.app_service_names))
  rds_instance_identifier    = "${var.project_name}-${var.environment}-postgres"
  redis_replication_group_id = "${var.project_name}-${var.environment}-redis"
  dlq_names                  = [for k, v in module.messaging.dlq_arns : split(":", v)[5]]
  alarm_email_recipients     = var.alarm_email_recipients
}
