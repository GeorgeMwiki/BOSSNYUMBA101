variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Apex domain for this environment (e.g. bossnyumba.com or staging.bossnyumba.com)"
  type        = string
}

variable "create_zone" {
  description = "Whether to create the hosted zone (false to look up an existing one)"
  type        = bool
  default     = false
}

variable "subject_alternative_names" {
  description = "Additional SANs on the ACM certificate (e.g. api.bossnyumba.com, app.bossnyumba.com)"
  type        = list(string)
  default     = []
}

variable "alb_alias_names" {
  description = "Fully qualified names to alias to the ALB"
  type        = list(string)
  default     = []
}

variable "alb_dns_name" {
  description = "ALB DNS name (from ecs module)"
  type        = string
}

variable "alb_zone_id" {
  description = "ALB zone id (from ecs module)"
  type        = string
}
