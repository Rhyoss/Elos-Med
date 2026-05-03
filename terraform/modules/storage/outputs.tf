output "buckets" {
  description = "Map of bucket names by purpose"
  value       = { for k, b in google_storage_bucket.buckets : k => b.name }
}

output "bucket_clinical_images" {
  value = google_storage_bucket.buckets["clinical_images"].name
}

output "bucket_prescriptions" {
  value = google_storage_bucket.buckets["prescriptions"].name
}

output "bucket_product_images" {
  value = google_storage_bucket.buckets["product_images"].name
}

output "bucket_avatars" {
  value = google_storage_bucket.buckets["avatars"].name
}

output "kms_key_phi" {
  value = google_kms_crypto_key.phi.id
}

output "kms_key_general" {
  value = google_kms_crypto_key.general.id
}
