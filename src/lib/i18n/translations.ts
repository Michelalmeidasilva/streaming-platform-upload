export const LOCALES = ['en', 'es', 'pt'] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

export const LOCALE_CODES: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
};

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'locale';
export const LOCALE_STORAGE_KEY = 'streaming-platform-upload:locale';

interface Dictionary {
  [key: string]: string | Dictionary;
}

const translations = {
  en: {
    metadata: {
      title: 'Streaming Platform Upload',
      description: 'Upload and manage your videos',
    },
    locale: {
      label: 'Language',
    },
    app: {
      sidebar: {
        library: 'Library',
        upload: 'Upload',
        dashboard: 'Dashboard',
        settings: 'Settings',
      },
      topbar: {
        library: 'Library',
      },
    },
    auth: {
      signInRequired: 'SIGN IN REQUIRED',
      signOut: 'Sign out',
      signInWithGoogle: 'Sign in with Google',
      signInAsE2EAdmin: 'Sign in as E2E admin',
      secureAccess: 'Secure access',
      restoringSession: 'Restoring your session',
      checkingSession: 'Checking your Google sign-in before loading the library.',
      protectMessage: 'Google sign-in protects uploads, edits, and downloads.',
      memberMessage: 'Members can browse and download. Admins can upload, rename, and delete videos. The server enforces the boundary either way.',
      session: 'Session',
      role: 'Role',
      capabilities: 'Capabilities',
      capabilitiesAdmin: 'Upload, edit, delete, view, search, download',
      capabilitiesMember: 'View, search, download',
      loadingSession: 'Loading session',
      checkingAccess: 'Checking access',
      preparingAccess: 'Preparing role-aware upload controls.',
      signInRequiredCopy: 'Sign in required',
      uploadProtected: 'Upload controls are protected',
      uploadProtectedCopy: 'Use Google sign-in to access admin upload actions.',
      memberAccess: 'Member access',
      uploadsAdminOnly: 'Uploads are available to admins only',
      memberBrowseCopy: 'You can still browse and download videos from the library.',
    },
    upload: {
      sectionLabel: 'Videos',
      dropzone: {
        idleTitle: 'Drag video files here',
        idleCopy: 'or click to select',
        activeTitle: 'Drop to start upload',
        activeCopy: 'Files detected',
        formats: 'Supported',
      },
      actions: {
        remove: 'Remove upload',
      },
      validation: {
        unsupportedFormat: 'Unsupported format. Supported formats: {{formats}}',
        fileTooLarge: 'File size exceeds 5GB limit',
      },
      rawVideo: {
        dimensionsPrompt: 'Raw .yuv has no header. Enter the frame size as WIDTHxHEIGHT (e.g. 1920x1080):',
        fpsPrompt: 'Enter the frame rate (fps), e.g. 30:',
        pixelFormatPrompt: 'Enter the pixel format (default yuv420p):',
        invalidDimensions: 'Invalid size. Use the WIDTHxHEIGHT format, e.g. 1920x1080.',
        invalidMetadata: 'Invalid raw video metadata. Width, height and fps must be positive numbers.',
      },
      uploadStatus: {
        uploading: '{{progress}}%',
        processing: 'Processing',
        ready: 'Ready',
        error: 'Error',
      },
      errors: {
        initiate: 'Failed to initiate upload',
        chunk: 'Chunk {{index}} upload failed',
        complete: 'Failed to complete upload',
        flow: 'Upload flow failed',
      },
      loading: {
        sessionLabel: 'Loading session',
        title: 'Checking access',
        copy: 'Preparing role-aware upload controls.',
      },
    },
    library: {
      search: {
        placeholder: 'Search your videos...',
        loading: 'Searching videos...',
      },
      loadingSession: 'Loading session...',
      signInToView: 'Sign in to view videos',
      signInToViewCopy: 'Authenticated members can search and download the library.',
      empty: {
        searchTitle: 'No results found',
        searchCopy: 'We could not find anything for "{{query}}"',
        emptyTitle: 'No videos yet',
        emptyCopy: 'Upload your first file to get started',
      },
      loadError: {
        signIn: 'Sign in to browse the library.',
        generic: 'Unable to load videos right now.',
      },
      status: {
        ready: 'Ready',
        processing: 'Processing',
        uploading: 'Uploading',
        error: 'Error',
      },
      memberOnly: 'Download only',
      actions: {
        delete: 'Delete',
      },
      formats: {
        sizeBytes: 'B',
        sizeKilobytes: 'KB',
        sizeMegabytes: 'MB',
        sizeGigabytes: 'GB',
      },
      dateFormat: {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      },
    },
    modal: {
      manageVideo: 'Manage video',
      closeLabel: 'Close video player',
      download: 'Download',
      downloading: 'Starting download…',
      saveTitle: 'Save title',
      saving: 'Saving...',
      delete: 'Delete',
      titleLabel: 'Video title',
    },
    roles: {
      admin: 'ADMIN',
      member: 'MEMBER',
    },
  },
  es: {
    metadata: {
      title: 'Carga de plataforma de streaming',
      description: 'Sube y administra tus videos',
    },
    locale: {
      label: 'Idioma',
    },
    app: {
      sidebar: {
        library: 'Biblioteca',
        upload: 'Subir',
        dashboard: 'Panel',
        settings: 'Ajustes',
      },
      topbar: {
        library: 'Biblioteca',
      },
    },
    auth: {
      signInRequired: 'SE REQUIERE INICIAR SESIÓN',
      signOut: 'Cerrar sesión',
      signInWithGoogle: 'Iniciar sesión con Google',
      signInAsE2EAdmin: 'Entrar como admin E2E',
      secureAccess: 'Acceso seguro',
      restoringSession: 'Restaurando tu sesión',
      checkingSession: 'Verificando tu inicio de sesión con Google antes de cargar la biblioteca.',
      protectMessage: 'El inicio de sesión con Google protege las cargas, ediciones y descargas.',
      memberMessage: 'Los miembros pueden explorar y descargar. Los administradores pueden subir, renombrar y borrar videos. El servidor aplica esa separación de todos modos.',
      session: 'Sesión',
      role: 'Rol',
      capabilities: 'Capacidades',
      capabilitiesAdmin: 'Subir, editar, borrar, ver, buscar, descargar',
      capabilitiesMember: 'Ver, buscar, descargar',
      loadingSession: 'Cargando sesión',
      checkingAccess: 'Verificando acceso',
      preparingAccess: 'Preparando controles de carga según el rol.',
      signInRequiredCopy: 'Se requiere iniciar sesión',
      uploadProtected: 'Los controles de carga están protegidos',
      uploadProtectedCopy: 'Usa Google para acceder a las acciones de administrador.',
      memberAccess: 'Acceso de miembro',
      uploadsAdminOnly: 'Las cargas están disponibles solo para administradores',
      memberBrowseCopy: 'Aun así puedes explorar y descargar videos de la biblioteca.',
    },
    upload: {
      sectionLabel: 'Videos',
      dropzone: {
        idleTitle: 'Arrastra archivos de video aquí',
        idleCopy: 'o haz clic para seleccionar',
        activeTitle: 'Suelta para iniciar la carga',
        activeCopy: 'Archivos detectados',
        formats: 'Compatibles',
      },
      actions: {
        remove: 'Eliminar carga',
      },
      validation: {
        unsupportedFormat: 'Formato no compatible. Formatos admitidos: {{formats}}',
        fileTooLarge: 'El archivo supera el límite de 5 GB',
      },
      rawVideo: {
        dimensionsPrompt: 'El .yuv crudo no tiene cabecera. Introduce el tamaño como ANCHOxALTO (p. ej. 1920x1080):',
        fpsPrompt: 'Introduce la tasa de fotogramas (fps), p. ej. 30:',
        pixelFormatPrompt: 'Introduce el formato de píxel (por defecto yuv420p):',
        invalidDimensions: 'Tamaño inválido. Usa el formato ANCHOxALTO, p. ej. 1920x1080.',
        invalidMetadata: 'Metadatos de vídeo crudo inválidos. El ancho, el alto y los fps deben ser positivos.',
      },
      uploadStatus: {
        uploading: '{{progress}}%',
        processing: 'Procesando',
        ready: 'Listo',
        error: 'Error',
      },
      errors: {
        initiate: 'No se pudo iniciar la carga',
        chunk: 'Falló la carga del fragmento {{index}}',
        complete: 'No se pudo completar la carga',
        flow: 'Falló el flujo de carga',
      },
      loading: {
        sessionLabel: 'Cargando sesión',
        title: 'Verificando acceso',
        copy: 'Preparando controles de carga según el rol.',
      },
    },
    library: {
      search: {
        placeholder: 'Busca tus videos...',
        loading: 'Buscando videos...',
      },
      loadingSession: 'Cargando sesión...',
      signInToView: 'Inicia sesión para ver videos',
      signInToViewCopy: 'Los miembros autenticados pueden buscar y descargar la biblioteca.',
      empty: {
        searchTitle: 'No se encontraron resultados',
        searchCopy: 'No encontramos nada para "{{query}}"',
        emptyTitle: 'Todavía no hay videos',
        emptyCopy: 'Sube tu primer archivo para comenzar',
      },
      loadError: {
        signIn: 'Inicia sesión para explorar la biblioteca.',
        generic: 'No se pueden cargar los videos ahora mismo.',
      },
      status: {
        ready: 'Listo',
        processing: 'Proceso',
        uploading: 'Subiendo',
        error: 'Error',
      },
      memberOnly: 'Solo descarga',
      actions: {
        delete: 'Eliminar',
      },
      formats: {
        sizeBytes: 'B',
        sizeKilobytes: 'KB',
        sizeMegabytes: 'MB',
        sizeGigabytes: 'GB',
      },
      dateFormat: {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      },
    },
    modal: {
      manageVideo: 'Administrar video',
      closeLabel: 'Cerrar reproductor de video',
      download: 'Descargar',
      downloading: 'Iniciando descarga…',
      saveTitle: 'Guardar título',
      saving: 'Guardando...',
      delete: 'Eliminar',
      titleLabel: 'Título del video',
    },
    roles: {
      admin: 'ADMIN',
      member: 'MIEMBRO',
    },
  },
  pt: {
    metadata: {
      title: 'Envio da plataforma de streaming',
      description: 'Envie e gerencie seus vídeos',
    },
    locale: {
      label: 'Idioma',
    },
    app: {
      sidebar: {
        library: 'Biblioteca',
        upload: 'Enviar',
        dashboard: 'Painel',
        settings: 'Configurações',
      },
      topbar: {
        library: 'Biblioteca',
      },
    },
    auth: {
      signInRequired: 'É NECESSÁRIO ENTRAR',
      signOut: 'Sair',
      signInWithGoogle: 'Entrar com Google',
      signInAsE2EAdmin: 'Entrar como admin E2E',
      secureAccess: 'Acesso seguro',
      restoringSession: 'Restaurando sua sessão',
      checkingSession: 'Verificando seu login do Google antes de carregar a biblioteca.',
      protectMessage: 'O login do Google protege envios, edições e downloads.',
      memberMessage: 'Membros podem navegar e baixar. Administradores podem enviar, renomear e excluir vídeos. O servidor aplica essa separação de qualquer forma.',
      session: 'Sessão',
      role: 'Função',
      capabilities: 'Capacidades',
      capabilitiesAdmin: 'Enviar, editar, excluir, ver, buscar, baixar',
      capabilitiesMember: 'Ver, buscar, baixar',
      loadingSession: 'Carregando sessão',
      checkingAccess: 'Verificando acesso',
      preparingAccess: 'Preparando controles de envio de acordo com a função.',
      signInRequiredCopy: 'É necessário entrar',
      uploadProtected: 'Os controles de envio estão protegidos',
      uploadProtectedCopy: 'Use o Google para acessar as ações de administrador.',
      memberAccess: 'Acesso de membro',
      uploadsAdminOnly: 'Os envios estão disponíveis apenas para administradores',
      memberBrowseCopy: 'Você ainda pode navegar e baixar vídeos da biblioteca.',
    },
    upload: {
      sectionLabel: 'Vídeos',
      dropzone: {
        idleTitle: 'Arraste arquivos de vídeo para cá',
        idleCopy: 'ou clique para selecionar',
        activeTitle: 'Solte para iniciar o envio',
        activeCopy: 'Arquivos detectados',
        formats: 'Compatíveis',
      },
      actions: {
        remove: 'Remover envio',
      },
      validation: {
        unsupportedFormat: 'Formato não suportado. Formatos aceitos: {{formats}}',
        fileTooLarge: 'O arquivo excede o limite de 5 GB',
      },
      rawVideo: {
        dimensionsPrompt: 'O .yuv cru não tem cabeçalho. Informe o tamanho como LARGURAxALTURA (ex.: 1920x1080):',
        fpsPrompt: 'Informe a taxa de quadros (fps), ex.: 30:',
        pixelFormatPrompt: 'Informe o pixel format (padrão yuv420p):',
        invalidDimensions: 'Tamanho inválido. Use o formato LARGURAxALTURA, ex.: 1920x1080.',
        invalidMetadata: 'Metadados de vídeo cru inválidos. Largura, altura e fps devem ser positivos.',
      },
      uploadStatus: {
        uploading: '{{progress}}%',
        processing: 'Processando',
        ready: 'Pronto',
        error: 'Erro',
      },
      errors: {
        initiate: 'Falha ao iniciar o envio',
        chunk: 'Falha ao enviar o bloco {{index}}',
        complete: 'Falha ao concluir o envio',
        flow: 'Falha no fluxo de envio',
      },
      loading: {
        sessionLabel: 'Carregando sessão',
        title: 'Verificando acesso',
        copy: 'Preparando controles de envio de acordo com a função.',
      },
    },
    library: {
      search: {
        placeholder: 'Pesquise seus vídeos...',
        loading: 'Pesquisando vídeos...',
      },
      loadingSession: 'Carregando sessão...',
      signInToView: 'Entre para ver os vídeos',
      signInToViewCopy: 'Membros autenticados podem buscar e baixar a biblioteca.',
      empty: {
        searchTitle: 'Nenhum resultado encontrado',
        searchCopy: 'Não encontramos nada para "{{query}}"',
        emptyTitle: 'Ainda não há vídeos',
        emptyCopy: 'Envie seu primeiro arquivo para começar',
      },
      loadError: {
        signIn: 'Entre para navegar pela biblioteca.',
        generic: 'Não foi possível carregar os vídeos agora.',
      },
      status: {
        ready: 'Pronto',
        processing: 'Processando',
        uploading: 'Enviando',
        error: 'Erro',
      },
      memberOnly: 'Somente download',
      actions: {
        delete: 'Excluir',
      },
      formats: {
        sizeBytes: 'B',
        sizeKilobytes: 'KB',
        sizeMegabytes: 'MB',
        sizeGigabytes: 'GB',
      },
      dateFormat: {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      },
    },
    modal: {
      manageVideo: 'Gerenciar vídeo',
      closeLabel: 'Fechar reprodutor de vídeo',
      download: 'Baixar',
      downloading: 'Iniciando download…',
      saveTitle: 'Salvar título',
      saving: 'Salvando...',
      delete: 'Excluir',
      titleLabel: 'Título do vídeo',
    },
    roles: {
      admin: 'ADMIN',
      member: 'MEMBRO',
    },
  },
} as const satisfies Record<Locale, Dictionary>;

function getValue(source: Dictionary, path: string): string | Dictionary | undefined {
  return path.split('.').reduce<string | Dictionary | undefined>((current, segment) => {
    if (!current || typeof current === 'string') {
      return undefined;
    }

    return current[segment];
  }, source);
}

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }

  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function normalizeLocale(value?: string | null): Locale {
  const raw = (value || '').toLowerCase();
  if (raw.startsWith('es')) return 'es';
  if (raw.startsWith('pt')) return 'pt';
  return 'en';
}

export function translate(locale: Locale, key: string, values?: Record<string, string | number>) {
  const value = getValue(translations[locale], key) ?? getValue(translations[DEFAULT_LOCALE], key);
  if (typeof value !== 'string') {
    return key;
  }

  return interpolate(value, values);
}

export function getLocaleCode(locale: Locale) {
  return LOCALE_CODES[locale];
}
