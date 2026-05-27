import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const { purchaseId, raffleId, quantity } = await req.json();
  if (!purchaseId || !raffleId || !Number.isInteger(quantity) || quantity < 1) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data, error } = await supabase.rpc("assign_random_raffle_tickets", {
    p_purchase_id: purchaseId,
    p_raffle_id: raffleId,
    p_qty: quantity,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 409 });
  }

  return new Response(JSON.stringify({ success: true, numbers: data }), {
    headers: { "content-type": "application/json" },
  });
});
