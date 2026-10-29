/**
 * TurnPot i18n — three locales: en, pt-BR, es.
 * Usage:
 *   const { t } = useI18n()
 *   t('home.hero.title')          // → "Save together.\nTake turns."
 *   t('pot.round', { n: 2, of: 5 }) // → "Round 2 of 5"
 */
import { useState, useEffect, useCallback } from 'react'

export type Locale = 'en' | 'pt-BR' | 'es'

// ─── Dictionary ───────────────────────────────────────────────────────────────

const dict: Record<Locale, Record<string, string>> = {
  en: {
    // ── Header ──
    'header.connect': 'Connect',
    'header.walletLabel': 'Wallet settings',

    // ── Banners ──
    'banner.wrongNetwork': 'TurnPot runs on Arc Mainnet and Arc Testnet — please switch using the network pill.',
    'banner.notDeployed': 'TurnPot is not deployed on Arc Mainnet yet.',
    'banner.deployNow': 'Deploy now',

    // ── Home ──
    'home.hero.title': 'Save together.\nTake turns.',
    'home.hero.desc': 'A rotating savings circle in USDC on {network}: everyone contributes each round, one member takes the full pot — until everyone has received it once.',
    'home.hero.descCompact': 'A rotating savings circle in USDC on {network}.',
    'home.hero.recipient': '★ This round\'s recipient',
    'home.hero.cultural': 'Known as {consorcio} in Brazil, {tanda} in Mexico, {susu} in West Africa. Powered by {network}.',
    'home.how.title': 'How it works',
    'home.how.step1': 'Everyone contributes the same USDC amount each round.',
    'home.how.step2': 'One member takes the whole pot — in a fixed rotation.',
    'home.how.step3': 'Repeat until everyone has received it once. Missed rounds are cancelled and refunded.',
    'home.cta.connect': 'Connect wallet to get started',
    'home.cta.create': 'Create a new pot',
    'home.myPots': 'My Pots',
    'home.scanning': 'Scanning pots…',
    'home.pot.members': '{n} members',
    'home.pot.round': 'Round {cur}/{total}',
    'home.pot.you': 'You #{n}',
    'home.pot.perMember': 'per member',

    // ── Create pot ──
    'create.title': 'Create a Pot',
    'create.members.title': 'Members ({n}/10)',
    'create.members.order': 'Payout order = list order',
    'create.members.you': 'you',
    'create.members.addMember': 'Add member',
    'create.members.dupError': 'Duplicate addresses are not allowed.',
    'create.members.countError': 'Pots need between 2 and 10 members.',
    'create.contribution.title': 'Contribution per member',
    'create.contribution.helper': 'Maximum 1 USDC per member per round.',
    'create.contribution.error': 'Must be between 0 and 1 USDC.',
    'create.contribution.totalLabel': 'Total pot per round',
    'create.duration.title': 'Round duration',
    'create.duration.demo': '2 min (demo)',
    'create.duration.1day': '1 day',
    'create.duration.1week': '1 week',
    'create.duration.1month': '1 month',
    'create.duration.info': 'If not all members pay before the deadline, anyone can cancel the round. Payers are refunded; non-payers accumulate a default count.',
    'create.notDeployed': 'TurnPot is not deployed on this network yet.',
    'create.submit': 'Create pot',
    'create.success': 'Pot created!',
    'create.timeout': 'Submitted — still waiting for confirmation',

    // ── Pot page ──
    'pot.round': 'Round {cur} of {total}',
    'pot.contribution': 'Contribution',
    'pot.totalPot': 'Total pot',
    'pot.deadline': 'Deadline',
    'pot.members': 'Members',
    'pot.paid': '{n}/{total} paid',
    'pot.copyInvite': 'Copy invite link',
    'pot.inviteCopied': 'Invite link copied!',
    'pot.refresh': 'Refresh',
    'pot.backToPots': 'Back to my pots',
    'pot.contribute': 'Contribute {amount} USDC',
    'pot.alreadyPaid': 'Paid this round ({amount} USDC)',
    'pot.closeRound': 'Close round ({n}/{total} paid)',
    'pot.cancelRound': 'Cancel round (deadline passed)',
    'pot.loading': 'Loading pot…',

    // ── Wallet panel ──
    'wallet.title': 'Withdrawable Balance',
    'wallet.withdraw': 'Withdraw',

    // ── History ──
    'history.title': 'History',
    'history.empty': 'No events yet.',

    // ── Status labels ──
    'status.active': 'Active',
    'status.completed': 'Completed',
    'status.cancelled': 'Cancelled',

    // ── Toasts ──
    'toast.potCreated': 'Pot created!',
    'toast.contributed': 'Contribution confirmed',
    'toast.roundClosed': 'Round closed',
    'toast.roundCancelled': 'Round cancelled — refunds credited',
    'toast.withdrawn': 'Withdrawn successfully',
    'toast.txTimeout': 'Transaction submitted — check the explorer for confirmation',
    'toast.txReverted': 'Transaction reverted on chain',
    'toast.contributeTimeout': 'Contribute tx submitted — check the explorer',
    'toast.contributeReverted': 'Contribute transaction reverted',
    'toast.closeTimeout': 'Close round tx submitted — check the explorer',
    'toast.closeReverted': 'Close round transaction reverted',
    'toast.cancelTimeout': 'Cancel round tx submitted — check the explorer',
    'toast.cancelReverted': 'Cancel round transaction reverted',
    'toast.withdrawTimeout': 'Withdraw tx submitted — check the explorer',
    'toast.withdrawReverted': 'Withdraw transaction reverted',

    // ── Errors ──
    'error.creatorNotMember': 'You must be listed as a member',
    'error.invalidMembers': 'Invalid member list',
    'error.invalidContribution': 'Invalid contribution amount',
    'error.invalidDuration': 'Round duration too short (min 60s)',
    'error.txFailed': 'Transaction failed',
    'error.alreadyPaid': 'You already paid this round',
    'error.roundExpired': 'Round deadline has passed',
    'error.wrongAmount': 'Wrong contribution amount',
    'error.notAllPaid': 'Not all members have paid yet',
    'error.closeFailed': 'Close round failed',
    'error.roundNotOver': 'Deadline has not passed yet',
    'error.allPaid': 'All members already paid — close instead',
    'error.cancelFailed': 'Cancel failed',
    'error.nothingToWithdraw': 'Nothing to withdraw',
    'error.withdrawFailed': 'Withdrawal failed',

    // ── Deploy page ──
    'deploy.title': 'Deploy TurnPot',
    'deploy.subtitle': 'Arc Mainnet (chain ID 5042)',
    'deploy.warning': 'This deploys to Arc Mainnet with real funds. The transaction is irreversible. Review the contract source and audit report before proceeding.',
    'deploy.walletTitle': 'Deploying wallet',
    'deploy.connectFirst': 'Connect your wallet (top right) to continue.',
    'deploy.chainCorrect': 'Arc Mainnet ✓',
    'deploy.chainWrong': 'Chain {id} (wrong)',
    'deploy.switchChain': 'Switch to Arc Mainnet',
    'deploy.button': 'Deploy TurnPot to Arc Mainnet',
    'deploy.signing': 'Confirm in wallet…',
    'deploy.confirming': 'Waiting for confirmation…',
    'deploy.success': 'Deployed successfully',
    'deploy.hint': 'Update VITE_TURNPOT_ADDRESS_MAINNET in your .env and set VITE_CHAIN=mainnet to point the app at this contract.',
    'deploy.sanityPassed': 'Sanity check passed',

    // ── Network names ──
    'network.mainnet': 'Mainnet',
    'network.testnet': 'Testnet',
    'network.wrong': 'Wrong network',
    'network.switchMainnet': 'Switch to Arc Mainnet',
    'network.switchTestnet': 'Switch to Arc Testnet',
    'network.testnetTooltip': 'Test USDC only, no real funds',

    // ── Address chip ──
    'addr.copy': 'Copy address',
    'addr.explorer': 'View on explorer',
    'addr.copied': 'Copied!',

    // ── Wallet drawer ──
    'drawer.balance': 'Balance',
    'drawer.withdrawable': 'Withdrawable',
    'drawer.withdraw': 'Withdraw',
    'drawer.disconnect': 'Disconnect',
    'drawer.activity': 'My activity',
    'drawer.loading': 'Loading activity…',
    'drawer.empty': 'No activity yet.',
    'drawer.contributed': 'Contributed to Pot #{id}',
    'drawer.receivedPot': 'Received pot from Pot #{id}',
    'drawer.refund': 'Refund from Pot #{id}',
    'drawer.withdrawn': 'Withdrew from TurnPot',
    'drawer.viewContract': 'View contract',
    'drawer.toast.withdrawn': 'Withdrawn successfully',
    'drawer.toast.withdrawTimeout': 'Withdraw tx submitted — check explorer',
    'drawer.toast.withdrawReverted': 'Withdraw transaction reverted',
    'drawer.toast.nothingToWithdraw': 'Nothing to withdraw',
    'drawer.toast.withdrawFailed': 'Withdrawal failed',

    // ── Protocol stats ──
    'stats.title': 'Protocol stats',
    'stats.pots': 'Pots',
    'stats.transactions': 'Transactions',
    'stats.totalUsdc': 'Total USDC',
    'stats.loading': 'Loading…',
    'stats.contract': 'Contract',
  },

  'pt-BR': {
    'header.connect': 'Conectar',
    'header.walletLabel': 'Configurações da carteira',

    'banner.wrongNetwork': 'TurnPot funciona na Arc Mainnet e Arc Testnet — use o seletor de rede.',
    'banner.notDeployed': 'TurnPot ainda não foi implantado na Arc Mainnet.',
    'banner.deployNow': 'Implantar agora',

    'home.hero.title': 'Poupe junto.\nReveze.',
    'home.hero.desc': 'Um consórcio em USDC na {network}: todos contribuem a cada rodada, um membro leva o pote completo — até que todos tenham recebido uma vez.',
    'home.hero.descCompact': 'Um consórcio em USDC na {network}.',
    'home.hero.recipient': '★ Beneficiário desta rodada',
    'home.hero.cultural': 'Conhecido como {consorcio} no Brasil, {tanda} no México, {susu} na África Ocidental. Powered by {network}.',
    'home.how.title': 'Como funciona',
    'home.how.step1': 'Todos contribuem com o mesmo valor em USDC a cada rodada.',
    'home.how.step2': 'Um membro leva o pote completo — em ordem rotativa.',
    'home.how.step3': 'Repita até que todos tenham recebido uma vez. Rodadas perdidas são canceladas e reembolsadas.',
    'home.cta.connect': 'Conectar carteira para começar',
    'home.cta.create': 'Criar um novo pote',
    'home.myPots': 'Meus Potes',
    'home.scanning': 'Buscando potes…',
    'home.pot.members': '{n} membros',
    'home.pot.round': 'Rodada {cur}/{total}',
    'home.pot.you': 'Você #{n}',
    'home.pot.perMember': 'por membro',

    'create.title': 'Criar um Pote',
    'create.members.title': 'Membros ({n}/10)',
    'create.members.order': 'Ordem de pagamento = ordem da lista',
    'create.members.you': 'você',
    'create.members.addMember': 'Adicionar membro',
    'create.members.dupError': 'Endereços duplicados não são permitidos.',
    'create.members.countError': 'Potes precisam de 2 a 10 membros.',
    'create.contribution.title': 'Contribuição por membro',
    'create.contribution.helper': 'Máximo de 1 USDC por membro por rodada.',
    'create.contribution.error': 'Deve ser entre 0 e 1 USDC.',
    'create.contribution.totalLabel': 'Pote total por rodada',
    'create.duration.title': 'Duração da rodada',
    'create.duration.demo': '2 min (demo)',
    'create.duration.1day': '1 dia',
    'create.duration.1week': '1 semana',
    'create.duration.1month': '1 mês',
    'create.duration.info': 'Se nem todos pagarem antes do prazo, qualquer um pode cancelar a rodada. Quem pagou é reembolsado; quem não pagou acumula inadimplências.',
    'create.notDeployed': 'TurnPot ainda não foi implantado nesta rede.',
    'create.submit': 'Criar pote',
    'create.success': 'Pote criado!',
    'create.timeout': 'Enviado — aguardando confirmação',

    'pot.round': 'Rodada {cur} de {total}',
    'pot.contribution': 'Contribuição',
    'pot.totalPot': 'Pote total',
    'pot.deadline': 'Prazo',
    'pot.members': 'Membros',
    'pot.paid': '{n}/{total} pagos',
    'pot.copyInvite': 'Copiar link de convite',
    'pot.inviteCopied': 'Link copiado!',
    'pot.refresh': 'Atualizar',
    'pot.backToPots': 'Voltar aos meus potes',
    'pot.contribute': 'Contribuir {amount} USDC',
    'pot.alreadyPaid': 'Pago nesta rodada ({amount} USDC)',
    'pot.closeRound': 'Fechar rodada ({n}/{total} pagos)',
    'pot.cancelRound': 'Cancelar rodada (prazo expirado)',
    'pot.loading': 'Carregando pote…',

    'wallet.title': 'Saldo para Saque',
    'wallet.withdraw': 'Sacar',

    'history.title': 'Histórico',
    'history.empty': 'Nenhum evento ainda.',

    'status.active': 'Ativo',
    'status.completed': 'Concluído',
    'status.cancelled': 'Cancelado',

    'toast.potCreated': 'Pote criado!',
    'toast.contributed': 'Contribuição confirmada',
    'toast.roundClosed': 'Rodada encerrada',
    'toast.roundCancelled': 'Rodada cancelada — reembolsos creditados',
    'toast.withdrawn': 'Saque realizado com sucesso',
    'toast.txTimeout': 'Transação enviada — verifique no explorador',
    'toast.txReverted': 'Transação revertida na chain',
    'toast.contributeTimeout': 'Contribuição enviada — verifique no explorador',
    'toast.contributeReverted': 'Transação de contribuição revertida',
    'toast.closeTimeout': 'Fechamento enviado — verifique no explorador',
    'toast.closeReverted': 'Transação de fechamento revertida',
    'toast.cancelTimeout': 'Cancelamento enviado — verifique no explorador',
    'toast.cancelReverted': 'Transação de cancelamento revertida',
    'toast.withdrawTimeout': 'Saque enviado — verifique no explorador',
    'toast.withdrawReverted': 'Transação de saque revertida',

    'error.creatorNotMember': 'Você deve estar listado como membro',
    'error.invalidMembers': 'Lista de membros inválida',
    'error.invalidContribution': 'Valor de contribuição inválido',
    'error.invalidDuration': 'Duração da rodada muito curta (mín. 60s)',
    'error.txFailed': 'Transação falhou',
    'error.alreadyPaid': 'Você já pagou nesta rodada',
    'error.roundExpired': 'O prazo da rodada expirou',
    'error.wrongAmount': 'Valor de contribuição incorreto',
    'error.notAllPaid': 'Nem todos os membros pagaram ainda',
    'error.closeFailed': 'Falha ao fechar rodada',
    'error.roundNotOver': 'O prazo ainda não expirou',
    'error.allPaid': 'Todos já pagaram — use encerrar rodada',
    'error.cancelFailed': 'Falha ao cancelar',
    'error.nothingToWithdraw': 'Nada para sacar',
    'error.withdrawFailed': 'Falha no saque',

    'deploy.title': 'Implantar TurnPot',
    'deploy.subtitle': 'Arc Mainnet (chain ID 5042)',
    'deploy.warning': 'Isso implanta na Arc Mainnet com fundos reais. A transação é irreversível. Revise o código do contrato antes de prosseguir.',
    'deploy.walletTitle': 'Carteira de implantação',
    'deploy.connectFirst': 'Conecte sua carteira (canto superior direito) para continuar.',
    'deploy.chainCorrect': 'Arc Mainnet ✓',
    'deploy.chainWrong': 'Chain {id} (incorreta)',
    'deploy.switchChain': 'Mudar para Arc Mainnet',
    'deploy.button': 'Implantar TurnPot na Arc Mainnet',
    'deploy.signing': 'Confirme na carteira…',
    'deploy.confirming': 'Aguardando confirmação…',
    'deploy.success': 'Implantado com sucesso',
    'deploy.hint': 'Atualize VITE_TURNPOT_ADDRESS_MAINNET no seu .env e defina VITE_CHAIN=mainnet.',
    'deploy.sanityPassed': 'Verificação aprovada',

    'network.mainnet': 'Mainnet',
    'network.testnet': 'Testnet',
    'network.wrong': 'Rede errada',
    'network.switchMainnet': 'Mudar para Arc Mainnet',
    'network.switchTestnet': 'Mudar para Arc Testnet',
    'network.testnetTooltip': 'Apenas USDC de teste, sem fundos reais',

    'addr.copy': 'Copiar endereço',
    'addr.explorer': 'Ver no explorador',
    'addr.copied': 'Copiado!',

    'drawer.balance': 'Saldo',
    'drawer.withdrawable': 'Para saque',
    'drawer.withdraw': 'Sacar',
    'drawer.disconnect': 'Desconectar',
    'drawer.activity': 'Minha atividade',
    'drawer.loading': 'Carregando atividade…',
    'drawer.empty': 'Nenhuma atividade ainda.',
    'drawer.contributed': 'Contribuiu para Pote #{id}',
    'drawer.receivedPot': 'Recebeu pote do Pote #{id}',
    'drawer.refund': 'Reembolso do Pote #{id}',
    'drawer.withdrawn': 'Sacou do TurnPot',
    'drawer.viewContract': 'Ver contrato',
    'drawer.toast.withdrawn': 'Saque realizado com sucesso',
    'drawer.toast.withdrawTimeout': 'Saque enviado — verifique no explorador',
    'drawer.toast.withdrawReverted': 'Transação de saque revertida',
    'drawer.toast.nothingToWithdraw': 'Nada para sacar',
    'drawer.toast.withdrawFailed': 'Falha no saque',

    'stats.title': 'Estatísticas do protocolo',
    'stats.pots': 'Potes',
    'stats.transactions': 'Transações',
    'stats.totalUsdc': 'Total USDC',
    'stats.loading': 'Carregando…',
    'stats.contract': 'Contrato',
  },

  es: {
    'header.connect': 'Conectar',
    'header.walletLabel': 'Configuración de billetera',

    'banner.wrongNetwork': 'TurnPot funciona en Arc Mainnet y Arc Testnet — cambia usando el selector de red.',
    'banner.notDeployed': 'TurnPot aún no está desplegado en Arc Mainnet.',
    'banner.deployNow': 'Desplegar ahora',

    'home.hero.title': 'Ahorren juntos.\nTurno a turno.',
    'home.hero.desc': 'Una tanda en USDC en {network}: todos contribuyen cada ronda, un miembro se lleva el pot completo — hasta que todos hayan recibido una vez.',
    'home.hero.descCompact': 'Una tanda en USDC en {network}.',
    'home.hero.recipient': '★ Beneficiario de esta ronda',
    'home.hero.cultural': 'Conocido como {consorcio} en Brasil, {tanda} en México, {susu} en África Occidental. Powered by {network}.',
    'home.how.title': 'Cómo funciona',
    'home.how.step1': 'Todos contribuyen el mismo monto en USDC cada ronda.',
    'home.how.step2': 'Un miembro se lleva el pot completo — en rotación fija.',
    'home.how.step3': 'Se repite hasta que todos hayan recibido una vez. Las rondas fallidas se cancelan y se reembolsan.',
    'home.cta.connect': 'Conectar billetera para comenzar',
    'home.cta.create': 'Crear un nuevo pot',
    'home.myPots': 'Mis Pots',
    'home.scanning': 'Buscando pots…',
    'home.pot.members': '{n} miembros',
    'home.pot.round': 'Ronda {cur}/{total}',
    'home.pot.you': 'Tú #{n}',
    'home.pot.perMember': 'por miembro',

    'create.title': 'Crear un Pot',
    'create.members.title': 'Miembros ({n}/10)',
    'create.members.order': 'Orden de pago = orden de la lista',
    'create.members.you': 'tú',
    'create.members.addMember': 'Agregar miembro',
    'create.members.dupError': 'No se permiten direcciones duplicadas.',
    'create.members.countError': 'Los pots necesitan entre 2 y 10 miembros.',
    'create.contribution.title': 'Contribución por miembro',
    'create.contribution.helper': 'Máximo 1 USDC por miembro por ronda.',
    'create.contribution.error': 'Debe ser entre 0 y 1 USDC.',
    'create.contribution.totalLabel': 'Pot total por ronda',
    'create.duration.title': 'Duración de la ronda',
    'create.duration.demo': '2 min (demo)',
    'create.duration.1day': '1 día',
    'create.duration.1week': '1 semana',
    'create.duration.1month': '1 mes',
    'create.duration.info': 'Si no todos pagan antes del plazo, cualquiera puede cancelar la ronda. Los que pagaron reciben reembolso; los que no acumulan incumplimientos.',
    'create.notDeployed': 'TurnPot aún no está desplegado en esta red.',
    'create.submit': 'Crear pot',
    'create.success': '¡Pot creado!',
    'create.timeout': 'Enviado — esperando confirmación',

    'pot.round': 'Ronda {cur} de {total}',
    'pot.contribution': 'Contribución',
    'pot.totalPot': 'Pot total',
    'pot.deadline': 'Plazo',
    'pot.members': 'Miembros',
    'pot.paid': '{n}/{total} pagaron',
    'pot.copyInvite': 'Copiar enlace de invitación',
    'pot.inviteCopied': '¡Enlace copiado!',
    'pot.refresh': 'Actualizar',
    'pot.backToPots': 'Volver a mis pots',
    'pot.contribute': 'Contribuir {amount} USDC',
    'pot.alreadyPaid': 'Pagado esta ronda ({amount} USDC)',
    'pot.closeRound': 'Cerrar ronda ({n}/{total} pagaron)',
    'pot.cancelRound': 'Cancelar ronda (plazo vencido)',
    'pot.loading': 'Cargando pot…',

    'wallet.title': 'Saldo Retirable',
    'wallet.withdraw': 'Retirar',

    'history.title': 'Historial',
    'history.empty': 'Aún no hay eventos.',

    'status.active': 'Activo',
    'status.completed': 'Completado',
    'status.cancelled': 'Cancelado',

    'toast.potCreated': '¡Pot creado!',
    'toast.contributed': 'Contribución confirmada',
    'toast.roundClosed': 'Ronda cerrada',
    'toast.roundCancelled': 'Ronda cancelada — reembolsos acreditados',
    'toast.withdrawn': 'Retiro realizado con éxito',
    'toast.txTimeout': 'Transacción enviada — verifica en el explorador',
    'toast.txReverted': 'Transacción revertida en la cadena',
    'toast.contributeTimeout': 'Contribución enviada — verifica en el explorador',
    'toast.contributeReverted': 'Transacción de contribución revertida',
    'toast.closeTimeout': 'Cierre enviado — verifica en el explorador',
    'toast.closeReverted': 'Transacción de cierre revertida',
    'toast.cancelTimeout': 'Cancelación enviada — verifica en el explorador',
    'toast.cancelReverted': 'Transacción de cancelación revertida',
    'toast.withdrawTimeout': 'Retiro enviado — verifica en el explorador',
    'toast.withdrawReverted': 'Transacción de retiro revertida',

    'error.creatorNotMember': 'Debes estar listado como miembro',
    'error.invalidMembers': 'Lista de miembros inválida',
    'error.invalidContribution': 'Monto de contribución inválido',
    'error.invalidDuration': 'Duración de ronda muy corta (mín. 60s)',
    'error.txFailed': 'Transacción fallida',
    'error.alreadyPaid': 'Ya pagaste en esta ronda',
    'error.roundExpired': 'El plazo de la ronda venció',
    'error.wrongAmount': 'Monto de contribución incorrecto',
    'error.notAllPaid': 'No todos los miembros han pagado aún',
    'error.closeFailed': 'Error al cerrar ronda',
    'error.roundNotOver': 'El plazo aún no ha vencido',
    'error.allPaid': 'Todos ya pagaron — cierra la ronda',
    'error.cancelFailed': 'Error al cancelar',
    'error.nothingToWithdraw': 'Nada que retirar',
    'error.withdrawFailed': 'Error en el retiro',

    'deploy.title': 'Desplegar TurnPot',
    'deploy.subtitle': 'Arc Mainnet (chain ID 5042)',
    'deploy.warning': 'Esto despliega en Arc Mainnet con fondos reales. La transacción es irreversible. Revisa el código del contrato antes de continuar.',
    'deploy.walletTitle': 'Billetera de despliegue',
    'deploy.connectFirst': 'Conecta tu billetera (arriba a la derecha) para continuar.',
    'deploy.chainCorrect': 'Arc Mainnet ✓',
    'deploy.chainWrong': 'Cadena {id} (incorrecta)',
    'deploy.switchChain': 'Cambiar a Arc Mainnet',
    'deploy.button': 'Desplegar TurnPot en Arc Mainnet',
    'deploy.signing': 'Confirma en la billetera…',
    'deploy.confirming': 'Esperando confirmación…',
    'deploy.success': 'Desplegado con éxito',
    'deploy.hint': 'Actualiza VITE_TURNPOT_ADDRESS_MAINNET en tu .env y define VITE_CHAIN=mainnet.',
    'deploy.sanityPassed': 'Verificación aprobada',

    'network.mainnet': 'Mainnet',
    'network.testnet': 'Testnet',
    'network.wrong': 'Red incorrecta',
    'network.switchMainnet': 'Cambiar a Arc Mainnet',
    'network.switchTestnet': 'Cambiar a Arc Testnet',
    'network.testnetTooltip': 'Solo USDC de prueba, sin fondos reales',

    'addr.copy': 'Copiar dirección',
    'addr.explorer': 'Ver en el explorador',
    'addr.copied': '¡Copiado!',

    'drawer.balance': 'Saldo',
    'drawer.withdrawable': 'Retirable',
    'drawer.withdraw': 'Retirar',
    'drawer.disconnect': 'Desconectar',
    'drawer.activity': 'Mi actividad',
    'drawer.loading': 'Cargando actividad…',
    'drawer.empty': 'Sin actividad aún.',
    'drawer.contributed': 'Contribuyó al Pot #{id}',
    'drawer.receivedPot': 'Recibió el pot del Pot #{id}',
    'drawer.refund': 'Reembolso del Pot #{id}',
    'drawer.withdrawn': 'Retiró de TurnPot',
    'drawer.viewContract': 'Ver contrato',
    'drawer.toast.withdrawn': 'Retiro exitoso',
    'drawer.toast.withdrawTimeout': 'Retiro enviado — verifica en el explorador',
    'drawer.toast.withdrawReverted': 'Transacción de retiro revertida',
    'drawer.toast.nothingToWithdraw': 'Nada que retirar',
    'drawer.toast.withdrawFailed': 'Falló el retiro',

    'stats.title': 'Estadísticas del protocolo',
    'stats.pots': 'Pots',
    'stats.transactions': 'Transacciones',
    'stats.totalUsdc': 'Total USDC',
    'stats.loading': 'Cargando…',
    'stats.contract': 'Contrato',
  },
}

// ─── Locale detection ─────────────────────────────────────────────────────────

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem('turnpot-lang')
    if (stored === 'en' || stored === 'pt-BR' || stored === 'es') return stored
  } catch { /* ignore */ }

  // Walk navigator.languages in priority order; fall back to navigator.language.
  const raw = navigator.languages as readonly string[] | undefined
  const langs: string[] =
    raw && raw.length > 0
      ? (raw as string[]).slice()
      : [navigator.language ?? 'en']
  for (const tag of langs) {
    if (tag.startsWith('pt')) return 'pt-BR'
    if (tag.startsWith('es')) return 'es'
    if (tag.startsWith('en')) return 'en'
  }
  return 'en'
}

// ─── HTML lang + global state ─────────────────────────────────────────────────
const HTML_LANG: Record<Locale, string> = {
  'en':    'en',
  'pt-BR': 'pt-BR',
  'es':    'es',
}

function applyHtmlLang(l: Locale) {
  try { document.documentElement.lang = HTML_LANG[l] } catch { /* SSR / test */ }
}

let _locale: Locale = detectLocale()
applyHtmlLang(_locale)           // set on first load, before any React render

const _listeners = new Set<() => void>()

export function setLocale(l: Locale) {
  _locale = l
  try { localStorage.setItem('turnpot-lang', l) } catch { /* ignore */ }
  applyHtmlLang(l)
  _listeners.forEach((fn) => fn())
}

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(_locale)

  useEffect(() => {
    const update = () => setLocaleState(_locale)
    _listeners.add(update)
    return () => { _listeners.delete(update) }
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const str = dict[locale]?.[key] ?? dict.en[key] ?? key
      if (!vars) return str
      return Object.entries(vars).reduce<string>(
        (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
        str,
      )
    },
    [locale],
  )

  return { t, locale, setLocale }
}
