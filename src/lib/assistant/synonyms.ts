/*
 * Sinônimos → categoria padrão (nomes das categorias criadas para todo espaço).
 * Ordem importa: padrões mais longos primeiro ("celular novo" antes de "celular").
 * As regras aprendidas do espaço (category_rules) têm prioridade sobre isto.
 */

export const EXPENSE_SYNONYMS: [string, string][] = [
  ["celular novo", "Compras"], ["passagem aerea", "Viagem"], ["passagem de aviao", "Viagem"], ["plano de saude", "Saúde"],
  ["conta de luz", "Contas e serviços"], ["conta de agua", "Contas e serviços"], ["conta de gas", "Contas e serviços"],
  ["mercado livre", "Compras"], ["amazon prime", "Assinaturas"], ["prime video", "Assinaturas"], ["youtube premium", "Assinaturas"],
  ["banho e tosa", "Pets"], ["material escolar", "Educação"], ["bilhete unico", "Transporte"], ["compras do mes", "Mercado"],
  // Transporte
  ["uber", "Transporte"], ["app99", "Transporte"], ["99pop", "Transporte"], ["99", "Transporte"], ["taxi", "Transporte"], ["cabify", "Transporte"],
  ["onibus", "Transporte"], ["metro", "Transporte"], ["trem", "Transporte"], ["gasolina", "Transporte"], ["etanol", "Transporte"],
  ["combustivel", "Transporte"], ["posto", "Transporte"], ["abasteci", "Transporte"], ["estacionamento", "Transporte"],
  ["pedagio", "Transporte"], ["oficina", "Transporte"], ["mecanico", "Transporte"], ["lava jato", "Transporte"], ["corrida", "Transporte"],
  // Restaurantes e delivery
  ["ifood", "Restaurantes e delivery"], ["delivery", "Restaurantes e delivery"], ["rappi", "Restaurantes e delivery"],
  ["lanche", "Restaurantes e delivery"], ["lanchonete", "Restaurantes e delivery"], ["pizza", "Restaurantes e delivery"],
  ["hamburguer", "Restaurantes e delivery"], ["burger", "Restaurantes e delivery"], ["restaurante", "Restaurantes e delivery"],
  ["almoco", "Restaurantes e delivery"], ["almocei", "Restaurantes e delivery"], ["janta", "Restaurantes e delivery"],
  ["jantar", "Restaurantes e delivery"], ["jantei", "Restaurantes e delivery"], ["sushi", "Restaurantes e delivery"],
  ["acai", "Restaurantes e delivery"], ["sorvete", "Restaurantes e delivery"], ["cafe", "Restaurantes e delivery"],
  ["mcdonalds", "Restaurantes e delivery"], ["mc donalds", "Restaurantes e delivery"], ["marmita", "Restaurantes e delivery"],
  ["pastel", "Restaurantes e delivery"], ["churrascaria", "Restaurantes e delivery"], ["comida", "Restaurantes e delivery"],
  ["esfiha", "Restaurantes e delivery"], ["coxinha", "Restaurantes e delivery"],
  // Mercado
  ["supermercado", "Mercado"], ["mercado", "Mercado"], ["feira", "Mercado"], ["padaria", "Mercado"], ["acougue", "Mercado"],
  ["hortifruti", "Mercado"], ["sacolao", "Mercado"], ["atacadao", "Mercado"], ["assai", "Mercado"], ["carrefour", "Mercado"], ["pao", "Mercado"],
  // Saúde
  ["farmacia", "Saúde"], ["drogaria", "Saúde"], ["remedio", "Saúde"], ["medico", "Saúde"], ["consulta", "Saúde"], ["dentista", "Saúde"],
  ["exame", "Saúde"], ["hospital", "Saúde"], ["academia", "Saúde"], ["psicologo", "Saúde"], ["terapia", "Saúde"],
  // Assinaturas
  ["netflix", "Assinaturas"], ["spotify", "Assinaturas"], ["disney", "Assinaturas"], ["hbo", "Assinaturas"], ["assinatura", "Assinaturas"],
  ["icloud", "Assinaturas"], ["chatgpt", "Assinaturas"], ["deezer", "Assinaturas"], ["globoplay", "Assinaturas"],
  // Moradia
  ["aluguel", "Moradia"], ["condominio", "Moradia"], ["diarista", "Moradia"], ["faxina", "Moradia"], ["reforma", "Moradia"],
  // Contas e serviços
  ["luz", "Contas e serviços"], ["energia", "Contas e serviços"], ["agua", "Contas e serviços"], ["internet", "Contas e serviços"],
  ["celular", "Contas e serviços"], ["telefone", "Contas e serviços"], ["gas", "Contas e serviços"], ["claro", "Contas e serviços"],
  ["vivo", "Contas e serviços"], ["tim", "Contas e serviços"],
  // Lazer
  ["cinema", "Lazer"], ["bar", "Lazer"], ["cerveja", "Lazer"], ["breja", "Lazer"], ["balada", "Lazer"], ["show", "Lazer"],
  ["ingresso", "Lazer"], ["festa", "Lazer"], ["jogo", "Lazer"], ["steam", "Lazer"], ["teatro", "Lazer"], ["boteco", "Lazer"], ["parque", "Lazer"],
  // Compras
  ["roupa", "Compras"], ["roupas", "Compras"], ["tenis", "Compras"], ["sapato", "Compras"], ["shopping", "Compras"], ["amazon", "Compras"],
  ["shopee", "Compras"], ["shein", "Compras"], ["tv", "Compras"], ["televisao", "Compras"], ["geladeira", "Compras"], ["notebook", "Compras"],
  ["fone", "Compras"], ["sofa", "Compras"], ["movel", "Compras"], ["moveis", "Compras"],
  // Cuidados pessoais
  ["cabelo", "Cuidados pessoais"], ["cabeleireiro", "Cuidados pessoais"], ["barbeiro", "Cuidados pessoais"], ["barbearia", "Cuidados pessoais"],
  ["manicure", "Cuidados pessoais"], ["unha", "Cuidados pessoais"], ["salao", "Cuidados pessoais"], ["perfume", "Cuidados pessoais"],
  ["maquiagem", "Cuidados pessoais"],
  // Pets
  ["racao", "Pets"], ["petshop", "Pets"], ["pet shop", "Pets"], ["veterinario", "Pets"], ["vet", "Pets"],
  // Viagem
  ["hotel", "Viagem"], ["pousada", "Viagem"], ["airbnb", "Viagem"], ["passagem", "Viagem"], ["voo", "Viagem"],
  // Educação
  ["escola", "Educação"], ["curso", "Educação"], ["faculdade", "Educação"], ["livro", "Educação"], ["mensalidade", "Educação"], ["alura", "Educação"],
  // Presentes e doações
  ["presente", "Presentes e doações"], ["doacao", "Presentes e doações"], ["dizimo", "Presentes e doações"], ["vaquinha", "Presentes e doações"],
  // Impostos e taxas
  ["imposto", "Impostos e taxas"], ["ipva", "Impostos e taxas"], ["iptu", "Impostos e taxas"], ["multa", "Impostos e taxas"],
  ["tarifa", "Impostos e taxas"], ["anuidade", "Impostos e taxas"], ["darf", "Impostos e taxas"], ["taxa", "Impostos e taxas"],
];

export const INCOME_SYNONYMS: [string, string][] = [
  ["decimo terceiro", "Salário"], ["13o", "Salário"], ["13", "Salário"], ["salario", "Salário"], ["holerite", "Salário"], ["adiantamento", "Salário"],
  ["freela", "Freelance"], ["freelance", "Freelance"], ["bico", "Freelance"], ["job", "Freelance"], ["projeto", "Freelance"], ["servico", "Freelance"],
  ["de presente", "Presentes"], ["presente", "Presentes"], ["aniversario", "Presentes"],
  ["rendimento", "Rendimentos"], ["rendeu", "Rendimentos"], ["juros", "Rendimentos"], ["dividendos", "Rendimentos"], ["cdb", "Rendimentos"],
  ["reembolso", "Reembolsos"], ["estorno", "Reembolsos"], ["devolucao", "Reembolsos"],
  ["vendi", "Outras receitas"], ["venda", "Outras receitas"], ["extra", "Outras receitas"], ["bonus", "Outras receitas"],
];
