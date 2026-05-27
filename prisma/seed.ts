import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding FixHub database...");

  // ── Categorías (nueva taxonomía verticalizada) ────────────────
  const emergencia = await prisma.category.upsert({
    where: { slug: "emergencia" },
    update: {
      name: "Servicios de Emergencia",
      description: "Atención inmediata 24/7 para urgencias del hogar",
      icon: "alert-triangle",
      order: 1,
    },
    create: {
      slug: "emergencia",
      name: "Servicios de Emergencia",
      description: "Atención inmediata 24/7 para urgencias del hogar",
      icon: "alert-triangle",
      order: 1,
    },
  });

  const reparacionSoporte = await prisma.category.upsert({
    where: { slug: "reparacion-soporte" },
    update: {
      name: "Reparación y Soporte Técnico",
      description: "Línea blanca, refrigeración y climatización",
      icon: "wrench",
      order: 2,
    },
    create: {
      slug: "reparacion-soporte",
      name: "Reparación y Soporte Técnico",
      description: "Línea blanca, refrigeración y climatización",
      icon: "wrench",
      order: 2,
    },
  });

  const mantenimientoHogar = await prisma.category.upsert({
    where: { slug: "mantenimiento-hogar" },
    update: {
      name: "Mantenimiento del Hogar",
      description: "Fumigación, limpieza, impermeabilización y acabados",
      icon: "home",
      order: 3,
    },
    create: {
      slug: "mantenimiento-hogar",
      name: "Mantenimiento del Hogar",
      description: "Fumigación, limpieza, impermeabilización y acabados",
      icon: "home",
      order: 3,
    },
  });

  const automotrizLogistica = await prisma.category.upsert({
    where: { slug: "automotriz-logistica" },
    update: {
      name: "Automotriz y Logística",
      description: "Mecánica a domicilio, grúas, fletes y mudanzas",
      icon: "truck",
      order: 4,
    },
    create: {
      slug: "automotriz-logistica",
      name: "Automotriz y Logística",
      description: "Mecánica a domicilio, grúas, fletes y mudanzas",
      icon: "truck",
      order: 4,
    },
  });

  const especializadosPrevision = await prisma.category.upsert({
    where: { slug: "especializados-prevision" },
    update: {
      name: "Especializados y Previsión",
      description: "Servicios funerarios y cuidado de mascotas",
      icon: "heart",
      order: 5,
    },
    create: {
      slug: "especializados-prevision",
      name: "Especializados y Previsión",
      description: "Servicios funerarios y cuidado de mascotas",
      icon: "heart",
      order: 5,
    },
  });

  // ── Servicios — 17 totales con la nueva taxonomía ─────────────
  // Los 5 existentes se MUEVEN a nuevas categorías (preservamos ServiceContent
  // generado por IA porque se relaciona por ID, no por slug).

  type SvcSpec = { slug: string; name: string; categoryId: string; requiresBrand: boolean; basePrice: number; description?: string };
  const serviceSpecs: SvcSpec[] = [
    // EMERGENCIA — urgente, 24/7, precio premium
    { slug: "cerrajeria", name: "Cerrajería 24/7", categoryId: emergencia.id, requiresBrand: false, basePrice: 500, description: "Apertura de puertas, autos y cambio de combinación 24/7" },
    { slug: "fuga-de-agua", name: "Reparación de Fugas y Plomería", categoryId: emergencia.id, requiresBrand: false, basePrice: 400, description: "Destape de drenajes, fugas, boilers y mantenimiento hidráulico" },
    { slug: "instalacion-electrica", name: "Electricistas a Domicilio", categoryId: emergencia.id, requiresBrand: false, basePrice: 450, description: "Cortocircuitos, instalaciones eléctricas y cajas de fusibles" },

    // REPARACIÓN Y SOPORTE — línea blanca + clima
    { slug: "reparacion-refrigeradores", name: "Reparación de Refrigeradores", categoryId: reparacionSoporte.id, requiresBrand: true, basePrice: 500, description: "Carga de gas, fallas de motor y sistemas No Frost" },
    { slug: "reparacion-lavadoras", name: "Reparación de Lavadoras", categoryId: reparacionSoporte.id, requiresBrand: true, basePrice: 450, description: "Transmisiones, bandas y tarjetas electrónicas" },
    { slug: "reparacion-secadoras", name: "Reparación de Secadoras", categoryId: reparacionSoporte.id, requiresBrand: true, basePrice: 450, description: "Sensores de humedad, resistencias y bandas" },
    { slug: "climatizacion", name: "Climatización y Minisplits", categoryId: reparacionSoporte.id, requiresBrand: false, basePrice: 500, description: "Instalación y mantenimiento de aire acondicionado y minisplits" },

    // MANTENIMIENTO DEL HOGAR — preventivo, precio medio
    { slug: "fumigacion-control-plagas", name: "Fumigación y Control de Plagas", categoryId: mantenimientoHogar.id, requiresBrand: false, basePrice: 350, description: "Tratamiento contra chinches, cucarachas y termitas" },
    { slug: "limpieza-especializada", name: "Limpieza Especializada", categoryId: mantenimientoHogar.id, requiresBrand: false, basePrice: 350, description: "Lavado de cisternas, tinacos, salas y alfombras" },
    { slug: "impermeabilizacion", name: "Impermeabilización", categoryId: mantenimientoHogar.id, requiresBrand: false, basePrice: 400, description: "Aplicación de aislantes térmicos y reparación de goteras" },
    { slug: "pintura-tablaroca", name: "Pintura y Tablaroca", categoryId: mantenimientoHogar.id, requiresBrand: false, basePrice: 350, description: "Acabados residenciales y comerciales" },

    // AUTOMOTRIZ Y LOGÍSTICA
    { slug: "mecanica-domicilio", name: "Mecánica a Domicilio", categoryId: automotrizLogistica.id, requiresBrand: false, basePrice: 400, description: "Afinaciones, frenos y diagnóstico con escáner" },
    { slug: "gruas-auxilio-vial", name: "Grúas y Auxilio Vial", categoryId: automotrizLogistica.id, requiresBrand: false, basePrice: 500, description: "Auxilio vial, paso de corriente y traslado de vehículos 24h" },
    { slug: "fletes-mudanzas", name: "Fletes y Mudanzas", categoryId: automotrizLogistica.id, requiresBrand: false, basePrice: 400, description: "Transportes locales y foráneos" },

    // ESPECIALIZADOS Y PREVISIÓN
    { slug: "servicios-funerarios", name: "Servicios Funerarios", categoryId: especializadosPrevision.id, requiresBrand: false, basePrice: 400, description: "Paquetes de previsión, cremación y capillas (humanos y mascotas)" },
    { slug: "cuidado-mascotas", name: "Cuidado de Mascotas", categoryId: especializadosPrevision.id, requiresBrand: false, basePrice: 350, description: "Clínicas veterinarias de urgencia y estética canina" },
  ];

  const servicesBySlug: Record<string, { id: string; name: string; categoryId: string; requiresBrand: boolean }> = {};
  for (const s of serviceSpecs) {
    const row = await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        categoryId: s.categoryId,
        requiresBrand: s.requiresBrand,
        basePrice: s.basePrice,
        description: s.description,
      },
      create: {
        slug: s.slug,
        name: s.name,
        categoryId: s.categoryId,
        requiresBrand: s.requiresBrand,
        basePrice: s.basePrice,
        description: s.description,
      },
    });
    servicesBySlug[s.slug] = row;
  }

  const lavadoras = servicesBySlug["reparacion-lavadoras"];
  const refrigeradores = servicesBySlug["reparacion-refrigeradores"];
  const secadoras = servicesBySlug["reparacion-secadoras"];

  // ── Borrar categorías obsoletas (línea-blanca, plomeria, electricidad) ──
  // Sus servicios ya fueron reasignados arriba via upsert. Ahora limpiamos.
  await prisma.category.deleteMany({
    where: { slug: { in: ["linea-blanca", "plomeria", "electricidad"] } },
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

  // ── Cuentas demo (técnico + admin) ────────────────────────────
  // GATED: solo crear si FIXHUB_SEED_DEMO === "true" y NO estamos en prod.
  // En prod usa `pnpm tsx scripts/create-admin.ts` con password manual.
  const seedDemoEnabled =
    process.env.FIXHUB_SEED_DEMO === "true" && process.env.NODE_ENV !== "production";

  if (seedDemoEnabled) {
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
  } else {
    console.log("⚠️  Demo accounts NOT created. Set FIXHUB_SEED_DEMO=true to enable in dev.");
    console.log("   Para crear admin en prod: pnpm tsx scripts/create-admin.ts");
  }

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
  if (seedDemoEnabled) {
    console.log("   Técnico: tecnico@fixhub.mx / demo1234 (saldo $1500 MXN)");
    console.log("   Admin:   admin@fixhub.mx   / demo1234");
  }
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
