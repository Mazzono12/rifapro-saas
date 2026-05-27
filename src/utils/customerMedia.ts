import type { Customer } from "../types";

const maxProfilePhotoSize = 20 * 1024 * 1024;
const acceptedProfilePhotoExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export async function uploadCustomerProfilePhoto(customerId: string, file?: File) {
  if (!file) return null;

  const extension = `.${file.name.split(".").pop() || ""}`.toLowerCase();
  if (!acceptedProfilePhotoExtensions.includes(extension)) {
    throw new Error("Formato não suportado. Use JPG, PNG, GIF ou WEBP.");
  }

  if (file.size > maxProfilePhotoSize) {
    throw new Error("A foto deve ter até 20MB.");
  }

  const res = await fetch(`/api/customers/${customerId}/photo`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": file.name,
    },
    body: await file.arrayBuffer(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao subir foto");
  return data.customer as Customer;
}

