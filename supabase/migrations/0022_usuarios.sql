-- MPH Sistema — tela de Usuários (menu RH, só Admin): criar usuário com senha inicial, editar nome/celular/setor,
-- ativar/desativar e redefinir senha. Com o cadastro público desligado, é por aqui que a equipe ganha acesso.
-- As funções rodam como dono do banco e conferem que quem chama é admin ativo.
-- Rode UMA vez no Supabase: SQL Editor → New query → cole tudo → Run (depois da 0021).

create or replace function public.criar_usuario(p_email text, p_nome text, p_papel public.papel, p_senha text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if public.meu_papel() is distinct from 'admin' then raise exception 'Só o administrador cria usuários.' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome.'; end if;
  if length(coalesce(p_senha, '')) < 8 then raise exception 'A senha precisa ter pelo menos 8 caracteres.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Já existe um usuário com este e-mail.'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('nome', trim(p_nome)), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());

  -- O gatilho handle_new_user cria o perfil (inativo); aqui ele já sai liberado com o setor escolhido.
  update public.perfis set nome = trim(p_nome), papel = p_papel, ativo = true where id = v_id;
  return v_id;
end $$;

create or replace function public.salvar_usuario(p_id uuid, p_nome text, p_celular text, p_papel public.papel, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meu_papel() is distinct from 'admin' then raise exception 'Só o administrador altera usuários.' using errcode = '42501'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome.'; end if;
  if p_id = auth.uid() and (p_papel <> 'admin' or not p_ativo) then
    raise exception 'Você não pode tirar o seu próprio acesso de administrador.';
  end if;
  update public.perfis set nome = trim(p_nome), celular = nullif(trim(p_celular), ''), papel = p_papel, ativo = p_ativo where id = p_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end $$;

create or replace function public.definir_senha_usuario(p_id uuid, p_senha text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.meu_papel() is distinct from 'admin' then raise exception 'Só o administrador redefine senhas.' using errcode = '42501'; end if;
  if length(coalesce(p_senha, '')) < 8 then raise exception 'A senha precisa ter pelo menos 8 caracteres.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end $$;

revoke execute on function public.criar_usuario(text, text, public.papel, text) from public, anon;
revoke execute on function public.salvar_usuario(uuid, text, text, public.papel, boolean) from public, anon;
revoke execute on function public.definir_senha_usuario(uuid, text) from public, anon;
