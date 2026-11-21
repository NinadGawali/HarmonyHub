output "public_ip" {
  description = "Elastic IP of the server. The app is served at https://<public_ip>."
  value       = aws_eip.app.public_ip
}

output "app_url" {
  value = "https://${aws_eip.app.public_ip}"
}

output "spotify_redirect_uri" {
  description = "Add this in the Spotify developer dashboard."
  value       = "https://${aws_eip.app.public_ip}/api/auth/spotify/callback"
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ssh_command" {
  value = "ssh -i infra/.secrets/harmonyhub-ssh.pem ubuntu@${aws_eip.app.public_ip}"
}
