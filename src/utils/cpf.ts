export const INVALID_CPF_MESSAGE = "CPF inválido. Verifique os números digitados e tente novamente.";

export function normalizeCpf(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidCpf(value: unknown) {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const calcDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += digits[index] * (length + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calcDigit(9) === digits[9] && calcDigit(10) === digits[10];
}

export function getCpfValidationError(value: unknown) {
  return isValidCpf(value) ? "" : INVALID_CPF_MESSAGE;
}

export function invalidCpfApiResponse() {
  return {
    success: false,
    code: "INVALID_CPF",
    field: "cpf",
    message: INVALID_CPF_MESSAGE
  };
}

export function isInvalidCpfGatewayError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /cpf|cpfcnpj|cpf\/cnpj|cnpj|documento|document/i.test(message) && /invalid|inval|invál|obrig|documento/i.test(message);
}