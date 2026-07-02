import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:64321';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkDatabaseLeads() {
  console.log("=== Querying database for check constraint violations and leads count ===");
  try {
    const { data: leads, error } = await supabase.from('leads').select('*');
    if (error) {
      console.error("Error fetching leads:", error);
      return;
    }

    console.log(`Total leads in DB: ${leads.length}`);

    let violationsCount = 0;

    // Check each lead for logical constraints that might not be enforced by DB CHECK constraints
    for (const lead of leads) {
      // 1. Check description_pendencia constraint manually
      if (lead.etapa === 'Pendencia' && (!lead.descricao_pendencia || lead.descricao_pendencia.trim().length === 0)) {
        console.log(`[VIOLATION] Lead ID ${lead.id} (${lead.nome_cliente}) is in etapa 'Pendencia' but has no description.`);
        violationsCount++;
      }

      // 2. Check resultado_analise constraint manually
      if (lead.etapa === 'Analise' && !lead.resultado_analise) {
        console.log(`[VIOLATION] Lead ID ${lead.id} (${lead.nome_cliente}) is in etapa 'Analise' but has no resultado_analise.`);
        violationsCount++;
      }

      // 3. Check motivo_resultado constraint manually
      if ((lead.resultado_analise === 'Condicionado' || lead.resultado_analise === 'Reprovado') && 
          (!lead.motivo_resultado || lead.motivo_resultado.trim().length === 0)) {
        console.log(`[VIOLATION] Lead ID ${lead.id} (${lead.nome_cliente}) has outcome '${lead.resultado_analise}' but no motivo_resultado.`);
        violationsCount++;
      }

      // 4. Check for invalid CPF formats
      const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
      if (!cpfRegex.test(lead.cpf_cliente)) {
        console.log(`[VIOLATION] Lead ID ${lead.id} (${lead.nome_cliente}) has invalid CPF format: '${lead.cpf_cliente}'`);
        violationsCount++;
      }
    }

    if (violationsCount === 0) {
      console.log("No check constraint violations found in existing database rows!");
    } else {
      console.log(`Found ${violationsCount} violation(s) in existing database rows.`);
    }

  } catch (err) {
    console.error("Unhandled error checking db:", err);
  }
}

checkDatabaseLeads();
