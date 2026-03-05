# Go-live final (Windows)

Use este checklist imediatamente antes de entregar para o cliente.

Preencha cada item com: **APROVADO** ou **REPROVADO**.

---

## 1) Pacote de release

- [ ] Binarios do Postgres embarcado em `build/windows/postgres/bin` (**APROVADO/REPROVADO**)
- [ ] CI Windows executado com sucesso no GitHub Actions (**APROVADO/REPROVADO**)
- [ ] Instalador `.exe` publicado no release correto (**APROVADO/REPROVADO**)

## 2) Instalacao - maquina Servidor

- [ ] Instalador executado em modo **Servidor** (**APROVADO/REPROVADO**)
- [ ] Tarefa agendada existe: `AgilizaPDV Store Server` (**APROVADO/REPROVADO**)
- [ ] Porta 3000 responde: `Test-NetConnection localhost -Port 3000` (**APROVADO/REPROVADO**)
- [ ] Health responde: `http://localhost:3000/health` (**APROVADO/REPROVADO**)
- [ ] Firewall com regra do servidor criada (**APROVADO/REPROVADO**)

## 3) Instalacao - maquina Terminal

- [ ] Instalador executado em modo **Computador terminal** (**APROVADO/REPROVADO**)
- [ ] Descoberta automatica encontrou servidor (mDNS) (**APROVADO/REPROVADO**)
- [ ] Login e navegacao normal no terminal (**APROVADO/REPROVADO**)

## 4) Tempo real na rede local (sem internet)

- [ ] Alteracao de produto em uma maquina aparece na outra imediatamente (**APROVADO/REPROVADO**)
- [ ] Venda feita em uma maquina aparece nas demais (**APROVADO/REPROVADO**)
- [ ] Estoque/saldo permanece consistente em todos os terminais (**APROVADO/REPROVADO**)

## 5) Sync com Supabase

- [ ] `SUPABASE_URL` e `SUPABASE_ANON_KEY` configurados no servidor (**APROVADO/REPROVADO**)
- [ ] `POST /sync/run` executa sem erro (**APROVADO/REPROVADO**)
- [ ] Contadores pendentes/erro convergem para 0 (**APROVADO/REPROVADO**)

## 6) Resiliencia (reboot e retomada)

- [ ] Reinicio do Windows sobe servidor automaticamente (**APROVADO/REPROVADO**)
- [ ] Terminais reconectam apos reboot do servidor (**APROVADO/REPROVADO**)
- [ ] Sistema continua operando offline na LAN apos reboot (**APROVADO/REPROVADO**)

## 7) Backup e suporte

- [ ] Backup local do banco validado (**APROVADO/REPROVADO**)
- [ ] Restore validado em ambiente de teste (**APROVADO/REPROVADO**)
- [ ] Script de diagnostico gera ZIP corretamente: `scripts/windows/diagnostico-runtime.ps1` (**APROVADO/REPROVADO**)

---

## Criterio final de liberacao

**GO-LIVE APROVADO** somente se todos os itens acima estiverem como **APROVADO**.

Se qualquer item estiver **REPROVADO**, nao liberar para cliente final.

