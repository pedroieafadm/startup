# Startup Escolar

App web instalável (PWA) de pontuação por turmas: os alunos representam suas salas, enviam fotos das tarefas e a escola avalia e lança os pontos. Multi-escola desde o início, com logo e cores de cada escola.

A especificação do MVP fica no documento do projeto. Já está pronto o ciclo principal: aluno envia a foto, o responsável avalia e os pontos entram no ranking e no extrato.

## O que já existe

- **Banco de dados** (`supabase/migrations/0001_base.sql`): escolas, turmas, perfis, convites, tarefas, envios de foto, extrato de pontos (sem apagar, só estornar), prêmios e interesse na IA. Cada escola só enxerga os próprios dados (RLS). Toda escola nova já nasce com o modelo pronto de tarefas.
- **Cadastro do aluno** (`supabase/migrations/0003_login_por_turma.sql`): o aluno entra em `/cadastro` com o e-mail institucional, cria a senha e informa o código da turma. O e-mail precisa ser do domínio da escola. O responsável vê o código no painel, pode gerar um novo e mover alunos de turma. A coordenação entra com um código de convite.
- **Plataforma** (`/plataforma`): cria escolas (com o domínio do e-mail dos alunos) e o convite do primeiro responsável.
- **Fotos** (`supabase/migrations/0002_fotos.sql`): bucket privado, cada turma só envia para a própria pasta, limite de envios por tarefa e período.
- **Painel da escola** (`/admin`): ranking do ano com destaque do mês, contador de fotos pendentes e turmas.
- **Fila de avaliação** (`/admin/fila`): foto, turma e tarefa, comentário opcional e os botões ganhar, perder ou descartar.
- **Turma no painel** (`/admin/turmas/...`): extrato com fotos, lançamento de pontos sem foto e estorno com motivo.
- **Aluno** (`/aluno`): ranking com a própria turma em destaque, envio de foto pela câmera, últimos envios da turma, extrato e a área da IA "em breve" com o botão "tenho interesse".

## Como rodar

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No Supabase, abra **SQL Editor** e rode, em ordem, os arquivos de `supabase/migrations/` (0001, 0002, 0003).
3. Em **Authentication > Providers > Email**, desligue "Confirm email" durante os testes (opcional).
4. Copie `.env.example` para `.env.local` e preencha a URL e a chave anon (Project Settings > API).
5. Rode:
   ```bash
   npm install
   npm run dev
   ```
6. Crie o primeiro administrador da plataforma: cadastre um usuário em **Authentication > Users > Add user** e rode no SQL Editor:
   ```sql
   insert into profiles (id, role, full_name)
   select id, 'platform_admin', 'Seu nome' from auth.users where email = 'seu@email.com';
   ```
7. Entre em `/entrar`, crie a escola em `/plataforma` e use o código gerado para criar a conta do responsável em `/cadastro`.

## Próximos passos

- Tarefas, prêmios e personalização (logo e cores) editáveis pelo painel.
- Avisos para a turma quando a foto for avaliada.
- Painel de uso da plataforma.
- Escola de demonstração com dados fictícios.
