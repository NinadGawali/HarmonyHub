# One EC2 instance with an Elastic IP in its own VPC.
# The app itself (docker compose + Caddy) is uploaded and started by infra/aws-deploy.sh.

# Own small network, so the account does not need a default VPC.
data "aws_ec2_instance_type_offerings" "available" {
  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }
  location_type = "availability-zone"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = var.name
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = var.name
  }
}

resource "aws_subnet" "public" {
  vpc_id = aws_vpc.main.id
  # First availability zone (alphabetically) that offers the instance type.
  availability_zone       = sort(data.aws_ec2_instance_type_offerings.available.locations)[0]
  cidr_block              = "10.42.1.0/24"
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.name}-public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = {
    Name = "${var.name}-public"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Ubuntu 24.04 LTS (Canonical's official images).
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# SSH key generated here; the private key is saved locally (never committed).
resource "tls_private_key" "ssh" {
  algorithm = "ED25519"
}

resource "aws_key_pair" "ssh" {
  key_name   = "${var.name}-key"
  public_key = tls_private_key.ssh.public_key_openssh
}

resource "local_sensitive_file" "ssh_private_key" {
  content         = tls_private_key.ssh.private_key_openssh
  filename        = var.ssh_key_path
  file_permission = "0600"
}

resource "aws_security_group" "app" {
  name        = "${var.name}-sg"
  description = "HarmonyHub: SSH from the operator, HTTP/HTTPS from anywhere"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }

  ingress {
    description = "HTTP for certificate validation and redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP/3"
    from_port   = 443
    to_port     = 443
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  key_name               = aws_key_pair.ssh.key_name
  vpc_security_group_ids = [aws_security_group.app.id]
  user_data              = file("${path.module}/cloud-init.sh")

  root_block_device {
    volume_size = var.disk_size_gb
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  tags = {
    Name = var.name
  }

  lifecycle {
    # A newer Ubuntu image must not replace the running server (and its data).
    ignore_changes = [ami, user_data]
  }
}

# Fixed public IP: the HTTPS certificate and the Spotify redirect URI are tied to it.
resource "aws_eip" "app" {
  domain = "vpc"
  tags = {
    Name = var.name
  }
}

resource "aws_eip_association" "app" {
  depends_on    = [aws_internet_gateway.main]
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}
