variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region for dashboard widgets"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix (arn ends at .../app/<name>/<id>, suffix is app/<name>/<id>)"
  type        = string
}

variable "ecs_cluster_name" {
  description = "Target ECS cluster name"
  type        = string
}

variable "ecs_service_names" {
  description = "Service names to alarm on"
  type        = list(string)
  default     = []
}

variable "rds_instance_identifier" {
  description = "RDS instance identifier (empty to skip RDS alarms)"
  type        = string
  default     = ""
}

variable "redis_replication_group_id" {
  description = "ElastiCache replication group ID (empty to skip Redis alarms)"
  type        = string
  default     = ""
}

variable "dlq_names" {
  description = "Dead letter queue names to watch"
  type        = list(string)
  default     = []
}

variable "alb_5xx_threshold" {
  description = "ALB 5xx count per minute that triggers an alarm"
  type        = number
  default     = 10
}

variable "rds_free_storage_bytes_threshold" {
  description = "Free storage threshold (bytes) below which to alarm"
  type        = number
  default     = 5368709120 # 5 GiB
}

variable "alarm_email_recipients" {
  description = "Email addresses subscribed to the alarm SNS topic"
  type        = list(string)
  default     = []
}
