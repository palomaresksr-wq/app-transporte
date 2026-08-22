import { getSupabaseClient } from "../infrastructure/supabase/client";

export type OnboardingState = {
  currentStep: number;
  completedSteps: number[];
  completedAt: string | null;
};

function client() {
  const value = getSupabaseClient();
  if (!value) throw new Error("Supabase no está configurado.");
  return value;
}

export async function loadOnboarding(organizationId: string): Promise<OnboardingState> {
  const { data, error } = await client().from("organization_onboarding")
    .select("current_step,completed_steps,completed_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el onboarding.");
  return data ? { currentStep: data.current_step, completedSteps: data.completed_steps, completedAt: data.completed_at } : { currentStep: 1, completedSteps: [], completedAt: null };
}

export async function saveOnboarding(organizationId: string, step: number, completedSteps: number[], complete = false): Promise<void> {
  const { data: auth } = await client().auth.getUser();
  if (!auth.user) throw new Error("Sesión requerida.");
  const { error } = await client().from("organization_onboarding").upsert({
    organization_id: organizationId,
    current_step: step,
    completed_steps: completedSteps,
    completed_at: complete ? new Date().toISOString() : null,
    completed_by: complete ? auth.user.id : null,
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error("No se pudo guardar el onboarding.");
}
