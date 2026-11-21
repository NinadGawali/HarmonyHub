variable "name" {
  description = "Name prefix for every AWS resource."
  type        = string
  default     = "harmonyhub"
}

variable "region" {
  description = "AWS region. ap-south-1 (Mumbai) is closest to India."
  type        = string
  default     = "ap-south-1"
}

variable "instance_type" {
  description = "EC2 instance type. t3.small (2 GB) runs the whole stack with swap for builds."
  type        = string
  default     = "t3.small"
}

variable "disk_size_gb" {
  description = "Root disk size in GB."
  type        = number
  default     = 20
}

variable "ssh_cidr" {
  description = "Who may SSH in, e.g. 203.0.113.7/32. infra/aws-up.sh sets this to your current public IP."
  type        = string
}

variable "ssh_key_path" {
  description = "Where the generated SSH private key is written on this computer."
  type        = string
  default     = "../.secrets/harmonyhub-ssh.pem"
}
