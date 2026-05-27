import { getSupabaseAdminClient } from "./supabaseAdmin";

export type ClienteRecord = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  created_at: string;
};

export type ClienteInput = {
  nome: string;
  email: string;
  telefone: string;
};

function normalizeCliente(input: Partial<ClienteInput>) {
  return {
    nome: String(input.nome || "").trim(),
    email: String(input.email || "").trim().toLowerCase(),
    telefone: String(input.telefone || "").replace(/[^\d+]/g, "")
  };
}

function validateCliente(input: Partial<ClienteInput>) {
  const cliente = normalizeCliente(input);
  if (!cliente.nome) throw new Error("Nome e obrigatorio.");
  if (!cliente.email.includes("@")) throw new Error("Email valido e obrigatorio.");
  if (cliente.telefone.length < 10) throw new Error("Telefone valido e obrigatorio.");
  return cliente;
}

function unwrap<T>(data: T | null, error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Erro Supabase.");
  return data as T;
}

export async function criarCliente(input: ClienteInput) {
  const cliente = validateCliente(input);
  const { data, error } = await getSupabaseAdminClient()
    .from("clientes")
    .insert(cliente)
    .select("id,nome,email,telefone,created_at")
    .single();
  return unwrap<ClienteRecord>(data, error);
}

export async function listarClientes() {
  const { data, error } = await getSupabaseAdminClient()
    .from("clientes")
    .select("id,nome,email,telefone,created_at")
    .order("created_at", { ascending: false });
  return unwrap<ClienteRecord[]>(data, error);
}

export async function buscarCliente(id: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("clientes")
    .select("id,nome,email,telefone,created_at")
    .eq("id", id)
    .single();
  return unwrap<ClienteRecord>(data, error);
}

export async function atualizarCliente(id: string, input: Partial<ClienteInput>) {
  const cliente = normalizeCliente(input);
  const updates = Object.fromEntries(
    Object.entries(cliente).filter(([, value]) => value)
  );
  if (!Object.keys(updates).length) throw new Error("Informe ao menos um campo para atualizar.");
  if (updates.email && !String(updates.email).includes("@")) throw new Error("Email invalido.");
  if (updates.telefone && String(updates.telefone).length < 10) throw new Error("Telefone invalido.");

  const { data, error } = await getSupabaseAdminClient()
    .from("clientes")
    .update(updates)
    .eq("id", id)
    .select("id,nome,email,telefone,created_at")
    .single();
  return unwrap<ClienteRecord>(data, error);
}

export async function deletarCliente(id: string) {
  const { error } = await getSupabaseAdminClient()
    .from("clientes")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}
