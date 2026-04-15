variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "visibility_timeout_seconds" {
  description = "SQS visibility timeout"
  type        = number
  default     = 60
}

variable "max_receive_count" {
  description = "Redrive threshold before moving to DLQ"
  type        = number
  default     = 5
}
