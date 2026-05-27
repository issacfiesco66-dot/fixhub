import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding FixHub database...");

  // ── Categorías ────────────────────────────────────────────────
  const lineaBlanca = await prisma.category.upsert({
    where: { slug: "linea-blanca" },
    update: {},
    create: {
      slug: "linea-blanca",
      name: "Línea Blanca",
      description: "Reparación de electrodomésticos de cocina y lavandería",
      icon: "washing-machine",
      order: 1,
    },
  });

  const plomeria = await prisma.category.upsert({
    where: { slug: "plomeria" },
    update: {},
    create: {
      slug: "plomeria",
      name: "Plomería",
      description: "Fugas, instalaciones y mantenimiento hidráulico",
      icon: "wrench",
      order: 2,
    },
  });

  const electricidad = await prisma.category.upsert({
    where: { slug: "electricidad" },
    update: {},
    create: {
      slug: "electricidad",
      name: "Electricidad",
      description: "Instalaciones, fallas eléctricas y mantenimiento",
      icon: "zap",
      order: 3,
    },
  });

  // ── Servicios ─────────────────────────────────────────────────
  const lavadoras = await prisma.service.upsert({
    where: { slug: "reparacion-lavadoras" },
    update: {},
    create: {
      slug: "reparacion-lavadoras",
      name: "Reparación de Lavadoras",
      description: "Diagnóstico y reparación de cualquier marca de lavadora",
      categoryId: lineaBlanca.id,
      requiresBrand: true,
      basePrice: 450,
    },
  });

  const refrigeradores = await prisma.service.upsert({
    where: { slug: "reparacion-refrigeradores" },
    update: {},
    create: {
      slug: "reparacion-refrigeradores",
      name: "Reparación de Refrigeradores",
      categoryId: lineaBlanca.id,
      requiresBrand: true,
      basePrice: 500,
    },
  });

  const secadoras = await prisma.service.upsert({
    where: { slug: "reparacion-secadoras" },
    update: {},
    create: {
      slug: "reparacion-secadoras",
      name: "Reparación de Secadoras",
      categoryId: lineaBlanca.id,
      requiresBrand: true,
      basePrice: 450,
    },
  });

  await prisma.service.upsert({
    where: { slug: "fuga-de-agua" },
    update: {},
    create: {
      slug: "fuga-de-agua",
      name: "Reparación de Fugas de Agua",
      categoryId: plomeria.id,
      requiresBrand: false,
      basePrice: 350,
    },
  });

  await prisma.service.upsert({
    where: { slug: "instalacion-electrica" },
    update: {},
    create: {
      slug: "instalacion-electrica",
      name: "Instalación Eléctrica",
      categoryId: electricidad.id,
      requiresBrand: false,
      basePrice: 400,
    },
  });

  // ── Marcas ────────────────────────────────────────────────────
  const brands = [
    { slug: "mabe", name: "Mabe" },
    { slug: "lg", name: "LG" },
    { slug: "samsung", name: "Samsung" },
    { slug: "whirlpool", name: "Whirlpool" },
    { slug: "ge", name: "General Electric" },
    { slug: "easy", name: "Easy" },
    { slug: "koblenz", name: "Koblenz" },
  ];

  for (const b of brands) {
    const brand = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: {},
      create: b,
    });
    // Vincular a servicios de línea blanca
    for (const sv of [lavadoras, refrigeradores, secadoras]) {
      await prisma.serviceBrand.upsert({
        where: { serviceId_brandId: { serviceId: sv.id, brandId: brand.id } },
        update: {},
        create: { serviceId: sv.id, brandId: brand.id },
      });
    }
  }

  // ── Estados ───────────────────────────────────────────────────
  const states = await Promise.all([
    prisma.state.upsert({ where: { slug: "jalisco" }, update: {}, create: { slug: "jalisco", name: "Jalisco" } }),
    prisma.state.upsert({ where: { slug: "cdmx" }, update: {}, create: { slug: "cdmx", name: "Ciudad de México" } }),
    prisma.state.upsert({ where: { slug: "queretaro-edo" }, update: {}, create: { slug: "queretaro-edo", name: "Querétaro" } }),
    prisma.state.upsert({ where: { slug: "puebla-edo" }, update: {}, create: { slug: "puebla-edo", name: "Puebla" } }),
    prisma.state.upsert({ where: { slug: "morelos" }, update: {}, create: { slug: "morelos", name: "Morelos" } }),
  ]);
  const [jalisco, cdmxState, qroState, pueState, morState] = states;

  // ── Ciudades (con coordenadas para Geo-SEO LocalBusiness) ─────
  const citySpecs = [
    { slug: "guadalajara", name: "Guadalajara", stateId: jalisco.id, latitude: 20.6597, longitude: -103.3496, phone: "+523312000000" },
    { slug: "zapopan", name: "Zapopan", stateId: jalisco.id, latitude: 20.7236, longitude: -103.3853, phone: "+523312000001" },
    { slug: "ciudad-de-mexico", name: "Ciudad de México", stateId: cdmxState.id, latitude: 19.4326, longitude: -99.1332, phone: "+525512000000" },
    // Plan Geo-SEO: 3 mercados estratégicos
    { slug: "queretaro", name: "Querétaro", stateId: qroState.id, latitude: 20.5888, longitude: -100.3899, phone: "+524422000000" },
    { slug: "puebla", name: "Puebla", stateId: pueState.id, latitude: 19.0414, longitude: -98.2063, phone: "+522222000000" },
    { slug: "cuernavaca", name: "Cuernavaca", stateId: morState.id, latitude: 18.9261, longitude: -99.2307, phone: "+527772000000" },
  ];
  const cityRows = await Promise.all(
    citySpecs.map((c) =>
      prisma.city.upsert({
        where: { slug: c.slug },
        update: { latitude: c.latitude, longitude: c.longitude, phone: c.phone },
        create: c,
      })
    )
  );
  const cityBySlug = Object.fromEntries(cityRows.map((c) => [c.slug, c]));
  const gdl = cityBySlug["guadalajara"];
  const zapopan = cityBySlug["zapopan"];
  const cdmx = cityBySlug["ciudad-de-mexico"];
  const queretaro = cityBySlug["queretaro"];
  const puebla = cityBySlug["puebla"];
  const cuernavaca = cityBySlug["cuernavaca"];

  // ── Zonas (según Plan Geo-SEO PDF) ────────────────────────────
  const zonas = [
    // Jalisco (existentes)
    { cityId: gdl.id, slug: "centro", name: "Centro" },
    { cityId: gdl.id, slug: "providencia", name: "Providencia" },
    { cityId: gdl.id, slug: "chapalita", name: "Chapalita" },
    { cityId: zapopan.id, slug: "andares", name: "Andares" },
    // CDMX
    { cityId: cdmx.id, slug: "polanco", name: "Polanco" },
    { cityId: cdmx.id, slug: "condesa", name: "Condesa" },
    // Querétaro — alto poder adquisitivo + línea blanca premium
    { cityId: queretaro.id, slug: "juriquilla", name: "Juriquilla" },
    { cityId: queretaro.id, slug: "el-refugio", name: "El Refugio" },
    { cityId: queretaro.id, slug: "zibata", name: "Zibatá" },
    { cityId: queretaro.id, slug: "corregidora", name: "Corregidora" },
    { cityId: queretaro.id, slug: "milenio-iii", name: "Milenio III" },
    { cityId: queretaro.id, slug: "centro-queretaro", name: "Centro Querétaro" },
    // Puebla — zonas residenciales exclusivas + densidad comercial
    { cityId: puebla.id, slug: "angelopolis", name: "Angelópolis" },
    { cityId: puebla.id, slug: "lomas-de-angelopolis", name: "Lomas de Angelópolis" },
    { cityId: puebla.id, slug: "cholula", name: "Cholula" },
    { cityId: puebla.id, slug: "las-animas", name: "Las Ánimas" },
    { cityId: puebla.id, slug: "zavaleta", name: "Zavaleta" },
    { cityId: puebla.id, slug: "centro-puebla", name: "Centro Puebla" },
    // Cuernavaca — casas fin de semana + clima húmedo = fallas frecuentes
    { cityId: cuernavaca.id, slug: "vista-hermosa", name: "Vista Hermosa" },
    { cityId: cuernavaca.id, slug: "lomas-de-cortes", name: "Lomas de Cortés" },
    { cityId: cuernavaca.id, slug: "civac", name: "Civac" },
    { cityId: cuernavaca.id, slug: "temixco", name: "Temixco" },
    { cityId: cuernavaca.id, slug: "tabachines", name: "Tabachines" },
    { cityId: cuernavaca.id, slug: "centro-cuernavaca", name: "Centro Cuernavaca" },
  ];
  for (const z of zonas) {
    await prisma.zone.upsert({
      where: { cityId_slug: { cityId: z.cityId, slug: z.slug } },
      update: {},
      create: z,
    });
  }

  // ── Paquetes de recarga ───────────────────────────────────────
  await prisma.rechargePackage.deleteMany({});
  await prisma.rechargePackage.createMany({
    data: [
      { name: "Paquete Inicial", amount: 1000, bonus: 0, order: 1 },
      { name: "Paquete Pro", amount: 2000, bonus: 200, popular: true, order: 2 },
      { name: "Paquete Premium", amount: 5000, bonus: 750, order: 3 },
    ],
  });

  // ── Técnico demo ──────────────────────────────────────────────
  const hash = await bcrypt.hash("demo1234", 10);
  const techUser = await prisma.user.upsert({
    where: { email: "tecnico@fixhub.mx" },
    update: {},
    create: {
      email: "tecnico@fixhub.mx",
      passwordHash: hash,
      name: "Juan Pérez",
      phone: "+523312345678",
      role: UserRole.TECHNICIAN,
    },
  });

  const tech = await prisma.technician.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      userId: techUser.id,
      displayName: "Juan Pérez — Especialista Línea Blanca",
      bio: "10 años de experiencia reparando lavadoras y refrigeradores.",
      yearsExp: 10,
      balance: 1500,
      active: true,
      verified: true,
    },
  });

  // Cobertura: GDL + Zapopan, servicios de línea blanca
  for (const cityId of [gdl.id, zapopan.id]) {
    await prisma.technicianCoverage.upsert({
      where: { technicianId_cityId: { technicianId: tech.id, cityId } },
      update: {},
      create: { technicianId: tech.id, cityId },
    });
  }
  for (const serviceId of [lavadoras.id, refrigeradores.id, secadoras.id]) {
    await prisma.technicianService.upsert({
      where: { technicianId_serviceId: { technicianId: tech.id, serviceId } },
      update: {},
      create: { technicianId: tech.id, serviceId },
    });
  }

  // Admin demo
  await prisma.user.upsert({
    where: { email: "admin@fixhub.mx" },
    update: {},
    create: {
      email: "admin@fixhub.mx",
      passwordHash: hash,
      name: "Admin",
      role: UserRole.ADMIN,
    },
  });

  // ── ServiceContent (Plan Geo-SEO PDF) ─────────────────────────
  // Los 3 textos pre-optimizados del PDF. Estos sirven como ejemplos
  // y como contenido inicial real para las URLs estratégicas.
  const lg = await prisma.brand.findUnique({ where: { slug: "lg" } });
  const whirlpool = await prisma.brand.findUnique({ where: { slug: "whirlpool" } });
  const samsung = await prisma.brand.findUnique({ where: { slug: "samsung" } });

  const contents = [
    {
      service: lavadoras,
      brand: lg,
      city: queretaro,
      h1: "Reparación de Lavadoras LG en Querétaro a Domicilio",
      metaDescription:
        "Servicio técnico especializado en lavadoras LG en Querétaro. Cobertura en Juriquilla, El Refugio, Zibatá y Milenio III. Refacciones originales y garantía por escrito.",
      body: `¿Tu lavadora LG con tecnología Inverter presenta fallas de drenado o muestra un código de error en el panel en la zona metropolitana de Querétaro? No arriesgues tu equipo con personal improvisado. Nuestro equipo técnico especializado ofrece cobertura inmediata en áreas residenciales clave como Juriquilla, El Refugio, Zibatá y Milenio III. Sabemos que el ritmo de vida en Querétaro exige soluciones rápidas; por ello, realizamos diagnósticos avanzados a domicilio utilizando refacciones 100% originales de la marca LG. Soluciona ruidos extraños en el centrifugado o problemas de encendido hoy mismo con una garantía por escrito que respalda la vida útil de tu electrodoméstico.`,
    },
    {
      service: refrigeradores,
      brand: whirlpool,
      city: puebla,
      h1: "Servicio Técnico de Refrigeradores Whirlpool en Puebla",
      metaDescription:
        "Reparación urgente de refrigeradores Whirlpool en Puebla. Atendemos Angelópolis, Lomas de Angelópolis, Cholula y Zavaleta. Diagnóstico el mismo día.",
      body: `Cuando un refrigerador Whirlpool deja de enfriar correctamente, la rapidez en el servicio es fundamental para proteger tus alimentos. En la ciudad de Puebla, proveemos un servicio técnico urgente con cobertura completa en zonas de alta plusvalía como Angelópolis, Lomas de Angelópolis, Cholula y Zavaleta. Nuestros técnicos certificados dominan los sistemas de refrigeración Whirlpool, atendiendo desde obstrucciones en el sistema de deshielo hasta fallas críticas en el compresor. Con atención las 24 horas para emergencias en la región poblana, te aseguramos una visita el mismo día con tarifas transparentes y el profesionalismo que tu hogar merece.`,
    },
    {
      service: secadoras,
      brand: samsung,
      city: cuernavaca,
      h1: "Técnico de Secadoras Samsung en Cuernavaca - Centro y Alrededores",
      metaDescription:
        "Reparación de secadoras Samsung en Cuernavaca. Cobertura en Vista Hermosa, Lomas de Cortés, Tabachines y Civac. Especialistas en clima húmedo.",
      body: `Las condiciones climáticas y la humedad en la Ciudad de la Eterna Primavera pueden acelerar el desgaste de los componentes electrónicos de tus centros de lavado. Si buscas reparación de secadoras Samsung en Cuernavaca, llegamos de inmediato a Vista Hermosa, Lomas de Cortés, Tabachines y Civac. Nos especializamos en corregir fallas comunes como falta de calentamiento, sensores de humedad dañados o problemas en la banda del tambor. Tu servicio técnico local en Cuernavaca garantiza un soporte rápido y eficiente, devolviendo la operatividad a tu equipo sin que tengas que salir de casa.`,
    },
  ];

  for (const c of contents) {
    if (!c.brand) continue;
    await prisma.serviceContent.upsert({
      where: {
        serviceId_brandId_cityId: {
          serviceId: c.service.id,
          brandId: c.brand.id,
          cityId: c.city.id,
        },
      },
      update: {
        h1: c.h1,
        metaDescription: c.metaDescription,
        body: c.body,
        source: "MANUAL",
        reviewed: true,
      },
      create: {
        serviceId: c.service.id,
        brandId: c.brand.id,
        cityId: c.city.id,
        h1: c.h1,
        metaDescription: c.metaDescription,
        body: c.body,
        source: "MANUAL",
        reviewed: true,
      },
    });
  }

  // ── Prospects de muestra (simulando scrape de Google Maps) ────
  await prisma.prospect.deleteMany({});
  await prisma.prospect.createMany({
    data: [
      {
        name: "Lavandería Express GDL",
        phone: "+523312223344",
        email: "contacto@lavanderiagdl.mx",
        city: "Guadalajara",
        source: "GoogleMaps_Scraper",
        notes: "Negocio con 4 lavadoras industriales — posible recurrente",
        status: "NEW",
      },
      {
        name: "María González",
        phone: "+523319998877",
        city: "Zapopan",
        source: "Facebook_Ad",
        notes: "Pidió cotización por refri Mabe",
        status: "NEW",
      },
      {
        name: "Edificio Torre Andares",
        phone: "+523325554433",
        email: "admon@torreandares.mx",
        city: "Zapopan",
        source: "GoogleMaps_Scraper",
        notes: "32 departamentos — contacto admin",
        status: "CONTACTED",
        contactedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        name: "Carlos Ramírez",
        phone: "+525511223344",
        city: "Ciudad de México",
        source: "Referido",
        notes: "Lo mandó cliente anterior — lavadora LG",
        status: "CONVERTED",
        contactedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("✅ Seed completado.");
  console.log("   Técnico: tecnico@fixhub.mx / demo1234 (saldo $1500 MXN)");
  console.log("   Admin:   admin@fixhub.mx   / demo1234");
  console.log("   Prospects de muestra: 4");
  console.log(`   Ciudades con coords: ${citySpecs.length} (incl. Querétaro, Puebla, Cuernavaca)`);
  console.log(`   Zonas geo-SEO: ${zonas.length}`);
  console.log(`   ServiceContent (Plan Geo-SEO): ${contents.filter((c) => c.brand).length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
