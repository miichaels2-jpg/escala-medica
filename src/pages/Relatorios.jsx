import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Hash,
  History,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

/* ============================================================
   CENTRAL DE INTELIGÊNCIA HOSPITALAR
   FASES 1 + 2 + 3
   ============================================================ */

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 0) {
  return safeNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return 'Não informado';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'Não informado';
  }

  return `R$ ${number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';

  const value = String(dateStr).split('T')[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  return value;
}

function normalizeDate(value) {
  if (!value) return '';

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.substring(0, 10);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/');
    return `${year}-${month}-${day}`;
  }

  return text.substring(0, 10);
}

function escapeCSV(value) {
  return `"${String(value ?? '')
    .replace(/"/g, '""')
    .replace(/\r?\n/g, ' ')}"`;
}

function sanitizeFilename(value) {
  return String(value || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPrintValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'number') {
    return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  }

  return String(value);
}

function getCompanyLabel(companyId) {
  return companyId || 'Não informado';
}

function getUnitLabel(unitId) {
  return unitId || 'Todas as unidades';
}

function buildPrintTable(columns = [], rows = [], totalsRow = null) {
  const headerHtml = columns
    .map(
      (column) => `
        <th>${escapeHtml(column)}</th>
      `
    )
    .join('');

  const bodyHtml =
    rows.length > 0
      ? rows
          .map(
            (row) => `
              <tr>
                ${columns
                  .map(
                    (_, index) => `
                      <td>${escapeHtml(
                        formatPrintValue(row[index])
                      )}</td>
                    `
                  )
                  .join('')}
              </tr>
            `
          )
          .join('')
      : `
          <tr>
            <td colspan="${Math.max(columns.length, 1)}" class="empty-cell">
              Nenhum registro encontrado para os filtros selecionados.
            </td>
          </tr>
        `;

  const footerHtml = totalsRow
    ? `
        <tfoot>
          <tr>
            ${columns
              .map(
                (_, index) => `
                  <th>${escapeHtml(
                    formatPrintValue(totalsRow[index])
                  )}</th>
                `
              )
              .join('')}
          </tr>
        </tfoot>
      `
    : '';

  return `
    <table class="print-table">
      <thead>
        <tr>${headerHtml}</tr>
      </thead>
      <tbody>
        ${bodyHtml}
      </tbody>
      ${footerHtml}
    </table>
  `;
}

function getStatusLabel(status) {
  const map = {
    confirmado: 'Confirmado',
    confirmed: 'Confirmado',
    pendente: 'Pendente',
    pending: 'Pendente',
    cancelado: 'Cancelado',
    canceled: 'Cancelado',
    aberto: 'Aberto',
    open: 'Aberto',
    concluido: 'Concluído',
    completed: 'Concluído',
  };

  return map[String(status || '').toLowerCase()] || status || 'Não informado';
}

function getStatusKey(status) {
  return String(status || '')
    .trim()
    .toLowerCase();
}

function getShiftHours(shift) {
  if (
    shift?.hours !== undefined &&
    shift?.hours !== null &&
    Number.isFinite(Number(shift.hours))
  ) {
    return Number(shift.hours);
  }

  if (
    shift?.total_hours !== undefined &&
    shift?.total_hours !== null &&
    Number.isFinite(Number(shift.total_hours))
  ) {
    return Number(shift.total_hours);
  }

  if (shift?.start_time && shift?.end_time) {
    const start = new Date(`1970-01-01T${shift.start_time}`);
    const end = new Date(`1970-01-01T${shift.end_time}`);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      let diff = (end - start) / 3600000;

      if (diff < 0) diff += 24;

      return Math.max(0, diff);
    }
  }

  return 0;
}

function getProfessionalId(shift) {
  return (
    shift?.professional_id ||
    shift?.professionalId ||
    shift?.professional?.id ||
    null
  );
}

function getProfessionalName(shift, professionalMap) {
  if (shift?.professional_name) {
    return shift.professional_name;
  }

  if (shift?.professional?.name) {
    return shift.professional.name;
  }

  if (shift?.professional_id && professionalMap[shift.professional_id]) {
    const professional = professionalMap[shift.professional_id];

    return (
      professional.name ||
      professional.full_name ||
      professional.nome ||
      professional.email ||
      'Profissional'
    );
  }

  return 'Não identificado';
}

function getSectorName(shift, sectorMap) {
  if (shift?.sector_name) {
    return shift.sector_name;
  }

  if (shift?.sector?.name) {
    return shift.sector.name;
  }

  if (shift?.sector_id && sectorMap[shift.sector_id]) {
    const sector = sectorMap[shift.sector_id];

    return (
      sector.name ||
      sector.nome ||
      sector.title ||
      'Setor não identificado'
    );
  }

  return 'Não informado';
}

function getCategoryName(shift, professionalMap) {
  if (shift?.category_name) return shift.category_name;
  if (shift?.category) return shift.category;

  if (shift?.professional_id && professionalMap[shift.professional_id]) {
    const professional = professionalMap[shift.professional_id];

    return (
      professional.category ||
      professional.profession ||
      professional.role ||
      professional.cargo ||
      'Não informado'
    );
  }

  return 'Não informado';
}

function getShiftDate(shift) {
  return normalizeDate(
    shift?.date ||
      shift?.shift_date ||
      shift?.start_date ||
      shift?.data ||
      shift?.created_date
  );
}

/* ============================================================
   SHA-256 REAL
   ============================================================ */

async function generateSHA256(input) {
  try {
    if (!window.crypto?.subtle) {
      return 'Indisponível neste navegador';
    }

    const data = new TextEncoder().encode(input);

    const hashBuffer = await window.crypto.subtle.digest(
      'SHA-256',
      data
    );

    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'Não foi possível calcular';
  }
}

/* ============================================================
   CONFIGURAÇÃO DOS RELATÓRIOS
   ============================================================ */

const REPORT_CONFIG = {
  executiva: {
    label: 'Visão Executiva',
    description: 'Indicadores consolidados para gestão e conselho',
    icon: LayoutDashboard,
    group: 'executiva',
  },

  produtividade: {
    label: 'Produtividade & Horas',
    description: 'Produção, horas e distribuição por profissional',
    icon: Clock3,
    group: 'operacional',
  },

  cobertura: {
    label: 'Cobertura & Mapa de Calor',
    description: 'Cobertura operacional por setor',
    icon: Building2,
    group: 'operacional',
  },

  risco: {
    label: 'Risco Assistencial',
    description: 'Indicadores operacionais de cobertura',
    icon: ShieldCheck,
    group: 'operacional',
  },

  financeiro: {
    label: 'Financeiro & Custos',
    description: 'Custos e estimativas com base nos dados disponíveis',
    icon: BarChart3,
    group: 'operacional',
  },

  turnover: {
    label: 'Cancelamentos & Absenteísmo',
    description: 'Ocorrências operacionais e cancelamentos',
    icon: Users,
    group: 'operacional',
  },

  auditoria: {
    label: 'Governança & Auditoria',
    description: 'Integridade, rastreabilidade e controle do relatório',
    icon: ClipboardCheck,
    group: 'governanca',
  },
};

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'aberto', label: 'Aberto' },
];

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function CentralInteligenciaHospitalar() {
  const { companyId, unitId } = useAppData();

  const [activeTab, setActiveTab] = useState('executiva');

  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sectorId: 'todos',
    status: 'todos',
    professionalId: 'todos',
    category: 'todos',
  });

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState('Rascunho');
  const [reportVersion, setReportVersion] = useState(1);
  const [reportHash, setReportHash] = useState('');
  const [hashLoading, setHashLoading] = useState(false);

  const [auditEvents, setAuditEvents] = useState([]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem('hospital-intelligence-theme');
      const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preferredTheme);
    } catch {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    try {
      window.localStorage.setItem('hospital-intelligence-theme', theme);
    } catch {
      // Ignorar erros de armazenamento local restrito
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  /* ============================================================
     CARREGAMENTO BLINDADO DE DADOS
     ============================================================ */

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError('');

      try {
        const queryFilter = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};

        const [
          shiftsResponse,
          professionalsResponse,
          sectorsResponse,
        ] = await Promise.all([
          base44.entities.Shift?.filter ? base44.entities.Shift.filter(queryFilter, '-date', 2000).catch(() => []) : base44.entities.Shift?.list?.().catch(() => []),
          base44.entities.Professional?.filter ? base44.entities.Professional.filter(queryFilter, '-created_date', 1000).catch(() => []) : base44.entities.Professional?.list?.().catch(() => []),
          base44.entities.Sector?.filter ? base44.entities.Sector.filter(queryFilter, '-created_date', 200).catch(() => []) : base44.entities.Sector?.list?.().catch(() => []),
        ]);

        setShifts(Array.isArray(shiftsResponse) ? shiftsResponse : []);
        setProfessionals(
          Array.isArray(professionalsResponse)
            ? professionalsResponse
            : []
        );
        setSectors(
          Array.isArray(sectorsResponse) ? sectorsResponse : []
        );
      } catch (err) {
        console.error(err);

        setError(
          'Não foi possível carregar os dados. Verifique a conexão com a base de dados.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, unitId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ============================================================
     MAPAS
     ============================================================ */

  const professionalMap = useMemo(() => {
    const map = {};

    professionals.forEach((professional) => {
      if (professional?.id) {
        map[professional.id] = professional;
      }
    });

    return map;
  }, [professionals]);

  const sectorMap = useMemo(() => {
    const map = {};

    sectors.forEach((sector) => {
      if (sector?.id) {
        map[sector.id] = sector;
      }
    });

    return map;
  }, [sectors]);

  /* ============================================================
     CATEGORIAS DISPONÍVEIS
     ============================================================ */

  const categories = useMemo(() => {
    const values = new Set();

    shifts.forEach((shift) => {
      const category = getCategoryName(shift, professionalMap);

      if (category && category !== 'Não informado') {
        values.add(category);
      }
    });

    professionals.forEach((professional) => {
      const category =
        professional?.category ||
        professional?.profession ||
        professional?.role ||
        professional?.cargo;

      if (category) {
        values.add(category);
      }
    });

    return Array.from(values).sort((a, b) =>
      String(a).localeCompare(String(b), 'pt-BR')
    );
  }, [shifts, professionals, professionalMap]);

  /* ============================================================
     FILTROS
     ============================================================ */

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const date = getShiftDate(shift);

      if (filters.startDate && date < filters.startDate) {
        return false;
      }

      if (filters.endDate && date > filters.endDate) {
        return false;
      }

      if (filters.sectorId !== 'todos') {
        const sectorMatches =
          String(shift?.sector_id || '') ===
            String(filters.sectorId) ||
          String(shift?.sector_name || '') ===
            String(filters.sectorId);

        if (!sectorMatches) {
          return false;
        }
      }

      if (filters.status !== 'todos') {
        const status = getStatusKey(shift?.status);

        if (status !== filters.status) {
          return false;
        }
      }

      if (filters.professionalId !== 'todos') {
        if (
          String(getProfessionalId(shift) || '') !==
          String(filters.professionalId)
        ) {
          return false;
        }
      }

      if (filters.category !== 'todos') {
        const category = getCategoryName(
          shift,
          professionalMap
        );

        if (String(category) !== String(filters.category)) {
          return false;
        }
      }

      return true;
    });
  }, [
    shifts,
    filters,
    professionalMap,
  ]);

  /* ============================================================
     INDICADORES BASE
     ============================================================ */

  const baseMetrics = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    let canceled = 0;
    let open = 0;

    let confirmedHours = 0;
    let totalHours = 0;

    filteredShifts.forEach((shift) => {
      const status = getStatusKey(shift?.status);
      const hours = getShiftHours(shift);

      totalHours += hours;

      if (
        status === 'confirmado' ||
        status === 'confirmed' ||
        status === 'concluido' ||
        status === 'completed'
      ) {
        confirmed++;
        confirmedHours += hours;
      } else if (
        status === 'pendente' ||
        status === 'pending'
      ) {
        pending++;
      } else if (
        status === 'cancelado' ||
        status === 'canceled'
      ) {
        canceled++;
      } else if (
        status === 'aberto' ||
        status === 'open'
      ) {
        open++;
      }
    });

    const total = filteredShifts.length;

    const coverage =
      total > 0 ? (confirmed / total) * 100 : 0;

    return {
      total,
      confirmed,
      pending,
      canceled,
      open,
      totalHours,
      confirmedHours,
      coverage,
    };
  }, [filteredShifts]);

  /* ============================================================
     PRODUTIVIDADE
     ============================================================ */

  const byProfessional = useMemo(() => {
    const map = {};

    filteredShifts.forEach((shift) => {
      const id =
        getProfessionalId(shift) ||
        `name:${getProfessionalName(
          shift,
          professionalMap
        )}`;

      if (!map[id]) {
        map[id] = {
          id,
          name: getProfessionalName(
            shift,
            professionalMap
          ),
          category: getCategoryName(
            shift,
            professionalMap
          ),
          total: 0,
          confirmed: 0,
          pending: 0,
          canceled: 0,
          open: 0,
          hours: 0,
        };
      }

      const row = map[id];
      const status = getStatusKey(shift?.status);

      row.total++;
      row.hours += getShiftHours(shift);

      if (
        status === 'confirmado' ||
        status === 'confirmed' ||
        status === 'concluido' ||
        status === 'completed'
      ) {
        row.confirmed++;
      } else if (
        status === 'pendente' ||
        status === 'pending'
      ) {
        row.pending++;
      } else if (
        status === 'cancelado' ||
        status === 'canceled'
      ) {
        row.canceled++;
      } else if (
        status === 'aberto' ||
        status === 'open'
      ) {
        row.open++;
      }
    });

    return Object.values(map).sort((a, b) => {
      return b.hours - a.hours;
    });
  }, [filteredShifts, professionalMap]);

  /* ============================================================
     COBERTURA POR SETOR
     ============================================================ */

  const bySector = useMemo(() => {
    const map = {};

    filteredShifts.forEach((shift) => {
      const name = getSectorName(shift, sectorMap);

      if (!map[name]) {
        map[name] = {
          name,
          total: 0,
          confirmed: 0,
          pending: 0,
          canceled: 0,
          open: 0,
          coverage: 0,
        };
      }

      const row = map[name];
      const status = getStatusKey(shift?.status);

      row.total++;

      if (
        status === 'confirmado' ||
        status === 'confirmed' ||
        status === 'concluido' ||
        status === 'completed'
      ) {
        row.confirmed++;
      } else if (
        status === 'pendente' ||
        status === 'pending'
      ) {
        row.pending++;
      } else if (
        status === 'cancelado' ||
        status === 'canceled'
      ) {
        row.canceled++;
      } else if (
        status === 'aberto' ||
        status === 'open'
      ) {
        row.open++;
      }
    });

    return Object.values(map)
      .map((row) => ({
        ...row,
        coverage:
          row.total > 0
            ? (row.confirmed / row.total) * 100
            : 0,
      }))
      .sort((a, b) => a.coverage - b.coverage);
  }, [filteredShifts, sectorMap]);

  /* ============================================================
     RISCO OPERACIONAL
     ============================================================ */

  const riskRows = useMemo(() => {
    return bySector.map((sector) => {
      let level = 'regular';

      if (sector.coverage < 70) {
        level = 'critico';
      } else if (sector.coverage < 90) {
        level = 'atencao';
      }

      return {
        ...sector,
        level,
      };
    });
  }, [bySector]);

  const criticalAlerts = useMemo(() => {
    const alerts = [];

    riskRows.forEach((row) => {
      if (row.level === 'critico') {
        alerts.push({
          type: 'critical',
          title: `Cobertura operacional baixa`,
          description: `${row.name}: ${formatNumber(
            row.coverage,
            1
          )}% dos registros estão confirmados.`,
        });
      }
    });

    if (baseMetrics.canceled > 0) {
      alerts.push({
        type: 'warning',
        title: 'Cancelamentos registrados',
        description: `${formatNumber(
          baseMetrics.canceled
        )} registro(s) de cancelamento no período.`,
      });
    }

    if (baseMetrics.pending > 0) {
      alerts.push({
        type: 'warning',
        title: 'Registros pendentes',
        description: `${formatNumber(
          baseMetrics.pending
        )} registro(s) aguardando confirmação.`,
      });
    }

    return alerts;
  }, [riskRows, baseMetrics]);

  /* ============================================================
     FINANCEIRO (Aperfeiçoado para separar cancelados)
     ============================================================ */

  const financialData = useMemo(() => {
    let estimatedCost = 0;
    let canceledCost = 0;
    let knownRates = 0;
    let missingRates = 0;

    const rows = [];

    filteredShifts.forEach((shift) => {
      const hours = getShiftHours(shift);
      const profId = getProfessionalId(shift);
      const prof = profId ? professionalMap[profId] : null;
      const status = getStatusKey(shift?.status);

      const remType = String(
        prof?.remuneration_type ||
          prof?.remunerationType ||
          'hora'
      ).toLowerCase();

      let rate = null;

      if (remType === 'hora') {
        rate =
          prof?.hourly_rate ??
          prof?.hourlyRate ??
          shift?.hourly_rate ??
          shift?.hour_rate ??
          shift?.valor_hora ??
          shift?.rate ??
          120;
      } else if (remType === 'diaria') {
        rate =
          prof?.daily_rate ??
          prof?.dailyRate ??
          1500;
      } else if (remType === 'mensal') {
        const monthly = Number(
          prof?.monthly_salary ??
            prof?.monthlySalary ??
            18000
        );

        const monthlyWorkHours = Number(
          prof?.monthly_work_hours ??
            prof?.monthlyWorkHours ??
            220
        );

        rate =
          monthlyWorkHours > 0
            ? monthly / monthlyWorkHours
            : null;
      }

      const numericRate = Number(rate);

      if (
        Number.isFinite(numericRate) &&
        numericRate >= 0 && rate !== null
      ) {
        const cost =
          remType === 'mensal'
            ? numericRate * hours
            : (remType === 'diaria' ? numericRate : hours * numericRate);

        if (status === 'cancelado' || status === 'canceled') {
          canceledCost += cost;
        } else {
          estimatedCost += cost;
        }
        
        knownRates++;

        rows.push({
          professional: getProfessionalName(
            shift,
            professionalMap
          ),
          sector: getSectorName(shift, sectorMap),
          hours,
          rate: numericRate,
          cost,
          status,
        });
      } else {
        missingRates++;

        rows.push({
          professional: getProfessionalName(
            shift,
            professionalMap
          ),
          sector: getSectorName(shift, sectorMap),
          hours,
          rate: null,
          cost: null,
          status,
        });
      }
    });

    // Ordenar para jogar os cancelados para o final da tabela
    rows.sort((a, b) => {
      const aCanc = a.status === 'cancelado' || a.status === 'canceled';
      const bCanc = b.status === 'cancelado' || b.status === 'canceled';
      if (aCanc && !bCanc) return 1;
      if (!aCanc && bCanc) return -1;
      return 0;
    });

    return {
      estimatedCost,
      canceledCost,
      knownRates,
      missingRates,
      rows,
    };
  }, [
    filteredShifts,
    professionalMap,
    sectorMap,
  ]);

  const totalFinancialEstimate = financialData.estimatedCost;

  /* ============================================================
     CANCELAMENTOS / ABSENTEÍSMO
     ============================================================ */

  const cancellationRows = useMemo(() => {
    return filteredShifts
      .filter((shift) => {
        const status = getStatusKey(shift?.status);

        return (
          status === 'cancelado' ||
          status === 'canceled'
        );
      })
      .map((shift) => ({
        date: getShiftDate(shift),
        professional: getProfessionalName(
          shift,
          professionalMap
        ),
        sector: getSectorName(shift, sectorMap),
        reason:
          shift?.cancellation_reason ||
          shift?.cancel_reason ||
          shift?.reason ||
          'Não informado',
      }))
      .sort((a, b) =>
        String(b.date).localeCompare(String(a.date))
      );
  }, [
    filteredShifts,
    professionalMap,
    sectorMap,
  ]);

  /* ============================================================
     ID DO RELATÓRIO
     ============================================================ */

  const reportId = useMemo(() => {
    const date = new Date();

    const datePart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');

    const timePart = [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
    ].join('');

    return `CIH-${datePart}-${timePart}`;
  }, []);

  /* ============================================================
     LABEL DOS FILTROS
     ============================================================ */

  const filtersLabel = useMemo(() => {
    const values = [];

    if (filters.startDate) {
      values.push(
        `Início: ${formatDateBR(filters.startDate)}`
      );
    }

    if (filters.endDate) {
      values.push(
        `Fim: ${formatDateBR(filters.endDate)}`
      );
    }

    if (filters.sectorId !== 'todos') {
      const sector = sectors.find(
        (item) =>
          String(item?.id) === String(filters.sectorId)
      );

      values.push(
        `Setor: ${
          sector?.name ||
          sector?.nome ||
          filters.sectorId
        }`
      );
    }

    if (filters.status !== 'todos') {
      values.push(
        `Status: ${getStatusLabel(filters.status)}`
      );
    }

    if (filters.professionalId !== 'todos') {
      const professional =
        professionals.find(
          (item) =>
            String(item?.id) ===
            String(filters.professionalId)
        );

      values.push(
        `Profissional: ${
          professional?.name ||
          professional?.full_name ||
          professional?.nome ||
          professional?.email ||
          filters.professionalId
        }`
      );
    }

    if (filters.category !== 'todos') {
      values.push(`Categoria: ${filters.category}`);
    }

    return values.length
      ? values.join(' • ')
      : 'Todos os registros disponíveis';
  }, [
    filters,
    sectors,
    professionals,
  ]);

  /* ============================================================
     PAYLOAD ESTÁVEL PARA INTEGRIDADE E IMPRESSÃO
     ============================================================ */

  const reportPayload =
    useMemo(() => {
      const config = REPORT_CONFIG[activeTab];

      let columns = [];
      let rows = [];
      let totalsRow = null;

      if (activeTab === 'executiva') {
        columns = [
          'Indicador',
          'Valor',
        ];

        rows = [
          ['Registros', baseMetrics.total],
          ['Confirmados', baseMetrics.confirmed],
          ['Pendentes', baseMetrics.pending],
          ['Cancelados', baseMetrics.canceled],
          ['Abertos', baseMetrics.open],
          [
            'Horas confirmadas',
            Number(baseMetrics.confirmedHours.toFixed(2)),
          ],
          [
            'Cobertura operacional',
            Number(baseMetrics.coverage.toFixed(2)),
          ],
          [
            'Custo financeiro estimado',
            Number(financialData.estimatedCost.toFixed(2)),
          ],
        ];
      }

      if (activeTab === 'produtividade') {
        columns = [
          'Profissional',
          'Categoria',
          'Total',
          'Confirmados',
          'Pendentes',
          'Cancelados',
          'Horas',
        ];

        rows = byProfessional.map((row) => [
          row.name,
          row.category,
          row.total,
          row.confirmed,
          row.pending,
          row.canceled,
          Number(row.hours.toFixed(2)),
        ]);

        totalsRow = [
          'TOTAL',
          '',
          baseMetrics.total,
          baseMetrics.confirmed,
          baseMetrics.pending,
          baseMetrics.canceled,
          Number(baseMetrics.totalHours.toFixed(2)),
        ];
      }

      if (
        activeTab === 'cobertura' ||
        activeTab === 'risco'
      ) {
        columns = [
          'Setor',
          'Total',
          'Confirmados',
          'Pendentes',
          'Cancelados',
          'Abertos',
          'Cobertura %',
        ];

        rows = bySector.map((row) => [
          row.name,
          row.total,
          row.confirmed,
          row.pending,
          row.canceled,
          row.open,
          Number(row.coverage.toFixed(2)),
        ]);

        totalsRow = [
          'TOTAL',
          baseMetrics.total,
          baseMetrics.confirmed,
          baseMetrics.pending,
          baseMetrics.canceled,
          baseMetrics.open,
          Number(baseMetrics.coverage.toFixed(2)),
        ];
      }

      if (activeTab === 'financeiro') {
        columns = [
          'Profissional',
          'Setor',
          'Horas',
          'Valor/Hora',
          'Custo Projetado',
        ];

        rows = financialData.rows.map((row) => {
          const isCanceled = row.status === 'cancelado' || row.status === 'canceled';

          return [
            isCanceled ? `${row.professional} (CANCELADO)` : row.professional,
            row.sector,
            Number(row.hours.toFixed(2)),
            row.rate === null
              ? 'Não informado'
              : Number(row.rate.toFixed(2)),
            isCanceled
              ? 'Cancelado'
              : row.cost === null
              ? 'Não informado'
              : Number(row.cost.toFixed(2)),
          ];
        });

        totalsRow = [
          'TOTAL ESTIMADO (SEM CANCELAMENTOS)',
          '',
          '',
          '',
          Number(financialData.estimatedCost.toFixed(2)),
        ];
      }

      if (activeTab === 'turnover') {
        columns = [
          'Data',
          'Profissional',
          'Setor',
          'Motivo',
        ];

        rows = cancellationRows.map((row) => [
          formatDateBR(row.date),
          row.professional,
          row.sector,
          row.reason,
        ]);
      }

      if (activeTab === 'auditoria') {
        columns = [
          'Evento',
          'Descrição',
          'Data/Hora',
        ];

        rows = auditEvents.map((event) => [
          event.type,
          event.description,
          event.timestamp,
        ]);
      }

      return {
        reportId,
        title: config?.label || 'Relatório',
        companyId: companyId || null,
        unitId: unitId || null,
        filters,
        filtersLabel,
        status: reportStatus,
        version: reportVersion,
        kpis: baseMetrics,
        columns,
        rows,
        totalsRow,
      };
    }, [
      activeTab,
      reportId,
      companyId,
      unitId,
      filters,
      filtersLabel,
      reportStatus,
      reportVersion,
      baseMetrics,
      byProfessional,
      bySector,
      financialData,
      cancellationRows,
      auditEvents,
    ]);

  /* ============================================================
     HASH
     ============================================================ */

  const calculateReportHash = useCallback(async () => {
    setHashLoading(true);

    try {
      const stablePayload = {
        reportId: reportPayload.reportId,
        title: reportPayload.title,
        companyId: reportPayload.companyId,
        unitId: reportPayload.unitId,
        filters: reportPayload.filters,
        status: reportPayload.status,
        version: reportPayload.version,
        kpis: reportPayload.kpis,
        columns: reportPayload.columns,
        rows: reportPayload.rows,
        totalsRow: reportPayload.totalsRow,
      };

      const serialized = JSON.stringify(
        stablePayload
      );

      const hash = await generateSHA256(serialized);

      setReportHash(hash);

      return hash;
    } finally {
      setHashLoading(false);
    }
  }, [reportPayload]);

  /* ============================================================
     AUDITORIA LOCAL DA SESSÃO
     ============================================================ */

  const addAuditEvent = useCallback(
    (type, description) => {
      const event = {
        id:
          typeof crypto !== 'undefined' &&
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        type,
        description,
        timestamp: new Date().toLocaleString(
          'pt-BR'
        ),
      };

      setAuditEvents((current) => [
        event,
        ...current,
      ]);
    },
    []
  );

  useEffect(() => {
    if (!loading) {
      addAuditEvent(
        'VISUALIZAÇÃO',
        `Relatório "${REPORT_CONFIG[activeTab]?.label}" selecionado.`
      );
    }
  }, [activeTab, loading, addAuditEvent]);

  /* ============================================================
     ABRIR RELATÓRIO
     ============================================================ */

  const openReportPreview = async () => {
    addAuditEvent(
      'RELATÓRIO',
      `Visualização do relatório "${REPORT_CONFIG[activeTab]?.label}" iniciada.`
    );

    setReportModalOpen(true);

    await calculateReportHash();
  };

  /* ============================================================
     IMPRESSÃO REESCRITA COM A4 PAISAGEM EM NOVA ABA
     ============================================================ */

  const printReport = useCallback(() => {
    addAuditEvent(
      'IMPRESSÃO',
      `Solicitação de impressão do relatório "${REPORT_CONFIG[activeTab]?.label}".`
    );

    const payload = reportPayload;

    const printWindow = window.open(
      '',
      '_blank',
      'width=1200,height=900,scrollbars=yes,resizable=yes'
    );

    if (!printWindow) {
      alert(
        'A impressão foi bloqueada pelo navegador. Permita pop-ups para este sistema e tente novamente.'
      );
      return;
    }

    const generatedAt = new Date().toLocaleString('pt-BR');

    const kpiItems = [
      ['Registros', formatNumber(payload.kpis?.total)],
      ['Confirmados', formatNumber(payload.kpis?.confirmed)],
      ['Pendentes', formatNumber(payload.kpis?.pending)],
      ['Cancelados', formatNumber(payload.kpis?.canceled)],
      ['Abertos', formatNumber(payload.kpis?.open)],
      [
        'Horas confirmadas',
        formatNumber(payload.kpis?.confirmedHours, 1),
      ],
      [
        'Cobertura operacional',
        `${formatNumber(payload.kpis?.coverage, 1)}%`,
      ],
    ];

    const kpisHtml = kpiItems
      .map(
        ([label, value]) => `
          <div class="kpi-box">
            <div class="kpi-label">${escapeHtml(label)}</div>
            <div class="kpi-value">${escapeHtml(value)}</div>
          </div>
        `
      )
      .join('');

    const tableHtml = buildPrintTable(
      payload.columns,
      payload.rows,
      payload.totalsRow
    );

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(payload.title)}</title>

          <style>
            @page {
              size: A4 landscape;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #172033;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10px;
            }

            body {
              padding: 0;
            }

            .print-document {
              width: 100%;
              max-width: 100%;
            }

            .print-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 20px;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }

            .print-brand {
              flex: 1;
            }

            .print-title {
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 5px;
              color: #0f172a;
            }

            .print-subtitle {
              font-size: 12px;
              color: #475569;
              margin: 0;
            }

            .print-meta {
              min-width: 230px;
              text-align: right;
              font-size: 9px;
              line-height: 1.6;
              color: #334155;
            }

            .print-meta strong {
              color: #0f172a;
            }

            .section-title {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 5px;
              margin: 16px 0 8px;
            }

            .filter-box {
              border: 1px solid #cbd5e1;
              background: #f8fafc;
              border-radius: 5px;
              padding: 9px;
              margin-bottom: 12px;
              line-height: 1.5;
            }

            .filter-label {
              font-weight: 700;
              color: #0f172a;
            }

            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(7, minmax(0, 1fr));
              gap: 7px;
              margin-bottom: 14px;
            }

            .kpi-box {
              border: 1px solid #cbd5e1;
              border-radius: 5px;
              padding: 8px;
              min-height: 58px;
              background: #ffffff;
            }

            .kpi-label {
              font-size: 8px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #64748b;
              margin-bottom: 6px;
            }

            .kpi-value {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
              overflow-wrap: anywhere;
            }

            .print-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: auto;
              margin-top: 8px;
              page-break-inside: auto;
            }

            .print-table thead {
              display: table-header-group;
            }

            .print-table tfoot {
              display: table-footer-group;
            }

            .print-table tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .print-table th {
              background: #e2e8f0;
              color: #0f172a;
              font-size: 8.5px;
              font-weight: 700;
              text-align: left;
              padding: 7px 6px;
              border: 1px solid #94a3b8;
              vertical-align: middle;
              overflow-wrap: anywhere;
            }

            .print-table td {
              font-size: 8.5px;
              padding: 6px;
              border: 1px solid #cbd5e1;
              vertical-align: top;
              overflow-wrap: anywhere;
              word-break: normal;
            }

            .print-table tbody tr:nth-child(even) td {
              background: #f8fafc;
            }

            .print-table tfoot th {
              background: #cbd5e1;
              border: 1px solid #94a3b8;
            }

            .empty-cell {
              text-align: center;
              padding: 20px !important;
              color: #64748b;
            }

            .print-footer {
              margin-top: 18px;
              padding-top: 8px;
              border-top: 1px solid #cbd5e1;
              display: flex;
              justify-content: space-between;
              gap: 15px;
              font-size: 8px;
              color: #64748b;
            }

            .print-signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 50px;
              margin-top: 42px;
              page-break-inside: avoid;
            }

            .signature-line {
              border-top: 1px solid #334155;
              padding-top: 6px;
              text-align: center;
              font-size: 9px;
              color: #334155;
            }

            .page-break {
              page-break-before: always;
              break-before: page;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .no-print {
                display: none !important;
              }
            }

            @media screen {
              body {
                background: #e2e8f0;
                padding: 25px;
              }

              .print-document {
                background: #ffffff;
                padding: 25px;
                max-width: 1400px;
                margin: 0 auto;
                box-shadow: 0 0 20px rgba(15, 23, 42, 0.12);
              }

              .no-print {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-bottom: 20px;
              }

              .no-print button {
                border: 0;
                border-radius: 5px;
                padding: 9px 15px;
                cursor: pointer;
                font-weight: 700;
              }

              .btn-print {
                background: #0284c7;
                color: #ffffff;
              }

              .btn-close {
                background: #cbd5e1;
                color: #0f172a;
              }
            }
          </style>
        </head>

        <body>
          <div class="no-print">
            <button class="btn-print" onclick="window.print()">
              Imprimir relatório
            </button>

            <button class="btn-close" onclick="window.close()">
              Fechar
            </button>
          </div>

          <main class="print-document">
            <header class="print-header">
              <div class="print-brand">
                <h1 class="print-title">
                  CENTRAL DE INTELIGÊNCIA HOSPITALAR
                </h1>

                <p class="print-subtitle">
                  ${escapeHtml(payload.title)}
                </p>
              </div>

              <div class="print-meta">
                <div>
                  <strong>ID:</strong>
                  ${escapeHtml(payload.reportId)}
                </div>

                <div>
                  <strong>Versão:</strong>
                  ${escapeHtml(payload.version)}
                </div>

                <div>
                  <strong>Status:</strong>
                  ${escapeHtml(payload.status)}
                </div>

                <div>
                  <strong>Gerado em:</strong>
                  ${escapeHtml(generatedAt)}
                </div>
              </div>
            </header>

            <section>
              <h2 class="section-title">
                Identificação e filtros aplicados
              </h2>

              <div class="filter-box">
                <div>
                  <span class="filter-label">Empresa:</span>
                  ${escapeHtml(getCompanyLabel(payload.companyId))}
                </div>

                <div>
                  <span class="filter-label">Unidade:</span>
                  ${escapeHtml(getUnitLabel(payload.unitId))}
                </div>

                <div>
                  <span class="filter-label">Filtros:</span>
                  ${escapeHtml(payload.filtersLabel)}
                </div>
              </div>
            </section>

            <section>
              <h2 class="section-title">
                Indicadores consolidados
              </h2>

              <div class="kpi-grid">
                ${kpisHtml}
              </div>
            </section>

            <section>
              <h2 class="section-title">
                Detalhamento do relatório
              </h2>

              ${tableHtml}
            </section>

            <section class="print-signatures">
              <div class="signature-line">
                Responsável pela emissão
              </div>

              <div class="signature-line">
                Responsável pela aprovação
              </div>
            </section>

            <footer class="print-footer">
              <span>
                Documento gerado pela Central de Inteligência Hospitalar.
              </span>

              <span>
                ${escapeHtml(payload.reportId)}
              </span>
            </footer>
          </main>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      try {
        printWindow.focus();
      } catch {
        // Ignorar falha de foco da janela
      }
    }, 300);
  }, [
    addAuditEvent,
    activeTab,
    reportPayload,
  ]);

  /* ============================================================
     CSV
     ============================================================ */

  const exportCSV = () => {
    const payload = reportPayload;

    const lines = [];

    lines.push(
      `${escapeCSV('CENTRAL DE INTELIGÊNCIA HOSPITALAR')}`
    );

    lines.push(
      `${escapeCSV('Relatório')};${escapeCSV(
        payload.title
      )}`
    );

    lines.push(
      `${escapeCSV('ID do relatório')};${escapeCSV(
        payload.reportId
      )}`
    );

    lines.push(
      `${escapeCSV('Versão')};${escapeCSV(
        payload.version
      )}`
    );

    lines.push(
      `${escapeCSV('Status')};${escapeCSV(
        payload.status
      )}`
    );

    lines.push(
      `${escapeCSV('Filtros')};${escapeCSV(
        payload.filtersLabel
      )}`
    );

    lines.push(
      `${escapeCSV('Gerado em')};${escapeCSV(
        new Date().toLocaleString('pt-BR')
      )}`
    );

    lines.push('');

    lines.push(
      payload.columns
        .map(escapeCSV)
        .join(';')
    );

    payload.rows.forEach((row) => {
      lines.push(
        row.map(escapeCSV).join(';')
      );
    });

    if (payload.totalsRow) {
      lines.push(
        payload.totalsRow
          .map(escapeCSV)
          .join(';')
      );
    }

    const content =
      '\uFEFF' + lines.join('\r\n');

    const filename = `${sanitizeFilename(
      payload.title
    )}-${payload.reportId}.csv`;

    downloadFile(
      content,
      filename,
      'text/csv;charset=utf-8;'
    );

    addAuditEvent(
      'EXPORTAÇÃO',
      `CSV exportado: ${filename}.`
    );
  };

  /* ============================================================
     STATUS DE GOVERNANÇA
     ============================================================ */

  const changeReportStatus = (status) => {
    setReportStatus(status);

    addAuditEvent(
      'GOVERNANÇA',
      `Status do relatório alterado para "${status}".`
    );
  };

  const createNewVersion = () => {
    setReportVersion((current) => current + 1);
    setReportStatus('Rascunho');
    setReportHash('');

    addAuditEvent(
      'VERSÃO',
      `Nova versão do relatório criada: v${
        reportVersion + 1
      }.`
    );
  };

  /* ============================================================
     RESET
     ============================================================ */

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      sectorId: 'todos',
      status: 'todos',
      professionalId: 'todos',
      category: 'todos',
    });

    addAuditEvent(
      'FILTROS',
      'Filtros restaurados para a configuração padrão.'
    );
  };

  /* ============================================================
     COMPONENTES VISUAIS
     ============================================================ */

  const activeConfig =
    REPORT_CONFIG[activeTab];

  const ActiveIcon = activeConfig?.icon || Activity;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-800 flex items-center justify-center shadow-xl">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>

          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Carregando Central de Inteligência
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Sincronizando dados hospitalares...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* ========================================================
          MOBILE HEADER
          ======================================================== */}

      <div className="lg:hidden sticky top-0 z-40 bg-slate-950 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={() =>
            setMobileMenuOpen(
              (current) => !current
            )
          }
          className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
          aria-label="Abrir menu"
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center">
            <Activity className="w-4 h-4 text-slate-950 dark:text-slate-50" />
          </div>

          <span className="font-semibold text-sm">
            Inteligência Hospitalar
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label={theme === 'dark' ? 'Ativar modo diurno' : 'Ativar modo escuro'}
          title={theme === 'dark' ? 'Modo diurno' : 'Modo escuro'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>

      {/* ========================================================
          LAYOUT
          ======================================================== */}

      <div className="flex min-h-screen">
        {/* ======================================================
            SIDEBAR CORPORATIVA (Otimizada Diurno e Noturno)
            ====================================================== */}

        <aside
          className={`
            fixed lg:sticky
            top-0
            left-0
            z-50
            h-screen
            w-[280px]
            bg-slate-950
            dark:bg-slate-900
            border-r
            border-slate-800
            text-white
            flex flex-col
            shadow-2xl
            transition-transform
            duration-300
            ${
              mobileMenuOpen
                ? 'translate-x-0'
                : '-translate-x-full lg:translate-x-0'
            }
          `}
        >
          <div className="px-6 py-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-900/40">
                <Activity className="w-6 h-6 text-white" />
              </div>

              <div>
                <div className="font-black text-sm tracking-wider text-white">
                  CENTRAL DE
                </div>

                <div className="text-xs font-semibold text-sky-400">
                  INTELIGÊNCIA HOSPITALAR
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-5">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Visão executiva
            </div>

            <SidebarItem
              active={activeTab === 'executiva'}
              icon={LayoutDashboard}
              label="Visão Executiva"
              onClick={() => {
                setActiveTab('executiva');
                setMobileMenuOpen(false);
              }}
            />

            <div className="mt-7 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Operacional
            </div>

            {[
              ['produtividade', Clock3],
              ['cobertura', Building2],
              ['risco', ShieldCheck],
              ['financeiro', BarChart3],
              ['turnover', Users],
            ].map(([key, Icon]) => (
              <SidebarItem
                key={key}
                active={activeTab === key}
                icon={Icon}
                label={REPORT_CONFIG[key].label}
                onClick={() => {
                  setActiveTab(key);
                  setMobileMenuOpen(false);
                }}
              />
            ))}

            <div className="mt-7 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Governança
            </div>

            <SidebarItem
              active={activeTab === 'auditoria'}
              icon={ClipboardCheck}
              label="Governança & Auditoria"
              onClick={() => {
                setActiveTab('auditoria');
                setMobileMenuOpen(false);
              }}
            />
          </div>

          <div className="border-t border-slate-800 p-4 bg-slate-900/50">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
              <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Ambiente protegido
              </div>

              <div className="mt-1 text-[10px] text-slate-400 leading-relaxed">
                Dados apresentados conforme disponibilidade da base
                operacional.
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay mobile */}
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() =>
              setMobileMenuOpen(false)
            }
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
        )}

        {/* ======================================================
            CONTEÚDO
            ====================================================== */}

        <main className="flex-1 min-w-0">
          {/* HEADER */}
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
            <div className="px-5 sm:px-8 py-5">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-sky-600 dark:bg-sky-500 items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
                    <ActiveIcon className="w-6 h-6 text-white" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Central de Inteligência
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900">
                        ONLINE
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-50 mt-1">
                      {activeConfig.label}
                    </h1>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeConfig.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={toggleTheme}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    aria-label={theme === 'dark' ? 'Ativar modo diurno' : 'Ativar modo escuro'}
                    title={theme === 'dark' ? 'Modo diurno' : 'Modo escuro'}
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      loadData(true)
                    }
                    disabled={refreshing}
                    className="gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        refreshing
                          ? 'animate-spin'
                          : ''
                      }`}
                    />
                    Atualizar
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportCSV}
                    className="gap-2 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    CSV
                  </Button>

                  <Button
                    type="button"
                    onClick={openReportPreview}
                    className="gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-md shadow-sky-600/20"
                  >
                    <Eye className="w-4 h-4" />
                    Visualizar relatório oficial
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* ====================================================
              FILTROS
              ==================================================== */}

          <section className="px-5 sm:px-8 pt-6">
            <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-slate-800 flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>

                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      Filtros do relatório
                    </h2>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Os indicadores abaixo refletem somente os
                      registros selecionados.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetFilters}
                  className="gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Limpar filtros
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
                <FilterField
                  label="Data inicial"
                  icon={CalendarDays}
                >
                  <Input
                    type="date"
                    value={filters.startDate}
                    max={filters.endDate || undefined}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        startDate:
                          event.target.value,
                      }))
                    }
                    className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                  />
                </FilterField>

                <FilterField
                  label="Data final"
                  icon={CalendarDays}
                >
                  <Input
                    type="date"
                    value={filters.endDate}
                    min={filters.startDate || undefined}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        endDate:
                          event.target.value,
                      }))
                    }
                    className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                  />
                </FilterField>

                <FilterField
                  label="Setor"
                  icon={Building2}
                >
                  <Select
                    value={String(
                      filters.sectorId
                    )}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        sectorId: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="todos">
                        Todos os setores
                      </SelectItem>

                      {(sectors || [])
                        .filter(
                          (sector) =>
                            sector?.id &&
                            sector?.name
                        )
                        .sort((a, b) =>
                          String(a.name).localeCompare(
                            String(b.name),
                            'pt-BR'
                          )
                        )
                        .map((sector) => (
                          <SelectItem
                            key={sector.id}
                            value={String(sector.id)}
                          >
                            {sector.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField
                  label="Status"
                  icon={CheckCircle2}
                >
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        status: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {STATUS_OPTIONS.map(
                        (option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField
                  label="Profissional"
                  icon={UserCheck}
                >
                  <Select
                    value={filters.professionalId}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        professionalId:
                          value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="todos">
                        Todos
                      </SelectItem>

                      {(professionals || [])
                        .filter(
                          (professional) =>
                            professional?.id
                        )
                        .sort((a, b) =>
                          getProfessionalName(a, professionalMap).localeCompare(
                            getProfessionalName(b, professionalMap),
                            'pt-BR'
                          )
                        )
                        .map((professional) => (
                          <SelectItem
                            key={professional.id}
                            value={String(professional.id)}
                          >
                            {getProfessionalName(professional, professionalMap)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField
                  label="Categoria"
                  icon={Users}
                >
                  <Select
                    value={filters.category}
                    onValueChange={(value) =>
                      setFilters((current) => ({
                        ...current,
                        category: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="todos">
                        Todas
                      </SelectItem>

                      {categories.map(
                        (category) => (
                          <SelectItem
                            key={category}
                            value={category}
                          >
                            {category}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </FilterField>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Filter className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="font-medium">
                    Filtro aplicado:
                  </span>
                </div>

                <span className="text-slate-700 dark:text-slate-300">
                  {filtersLabel}
                </span>
              </div>
            </Card>
          </section>

          {/* ====================================================
              ERRO
              ==================================================== */}

          {error && (
            <section className="px-5 sm:px-8 pt-5">
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />

                <div>
                  <div className="font-semibold text-red-900 dark:text-red-100">
                    Falha no carregamento
                  </div>

                  <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {error}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ====================================================
              ALERTAS
              ==================================================== */}

          {criticalAlerts.length > 0 &&
            activeTab !== 'auditoria' && (
              <section className="px-5 sm:px-8 pt-5">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {criticalAlerts
                    .slice(0, 4)
                    .map((alert, index) => (
                      <div
                        key={`${alert.title}-${index}`}
                        className={`
                          rounded-xl border p-4 flex gap-3
                          ${
                            alert.type ===
                            'critical'
                              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50'
                              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50'
                          }
                        `}
                      >
                        <div
                          className={`
                            w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                            ${
                              alert.type ===
                              'critical'
                                ? 'bg-red-100 dark:bg-red-900/50'
                                : 'bg-amber-100 dark:bg-amber-900/50'
                            }
                          `}
                        >
                          <AlertTriangle
                            className={`
                              w-4 h-4
                              ${
                                alert.type ===
                                'critical'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            `}
                          />
                        </div>

                        <div>
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {alert.title}
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            {alert.description}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

          {/* ====================================================
              KPI
              ==================================================== */}

          {activeTab !== 'auditoria' && (
            <section className="px-5 sm:px-8 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <KpiCard
                  icon={Database}
                  label="Registros"
                  value={formatNumber(
                    baseMetrics.total
                  )}
                  description="No período filtrado"
                />

                <KpiCard
                  icon={CheckCircle2}
                  label="Confirmados"
                  value={formatNumber(
                    baseMetrics.confirmed
                  )}
                  description={`${formatNumber(
                    baseMetrics.coverage,
                    1
                  )}% do total`}
                  positive
                />

                <KpiCard
                  icon={Clock3}
                  label="Horas confirmadas"
                  value={formatNumber(
                    baseMetrics.confirmedHours,
                    1
                  )}
                  description="Horas contabilizadas"
                />

                <KpiCard
                  icon={AlertTriangle}
                  label="Pendentes"
                  value={formatNumber(
                    baseMetrics.pending
                  )}
                  description="Aguardando confirmação"
                  warning={
                    baseMetrics.pending > 0
                  }
                />

                <KpiCard
                  icon={TrendingDown}
                  label="Cancelamentos"
                  value={formatNumber(
                    baseMetrics.canceled
                  )}
                  description="Registros cancelados"
                  warning={
                    baseMetrics.canceled > 0
                  }
                />
              </div>
            </section>
          )}

          {/* ====================================================
              CONTEÚDO DOS RELATÓRIOS
              ==================================================== */}

          <section className="px-5 sm:px-8 py-6">
            {activeTab === 'executiva' && (
              <ExecutiveView
                baseMetrics={baseMetrics}
                riskRows={riskRows}
                byProfessional={byProfessional}
                criticalAlerts={
                  criticalAlerts
                }
                financialData={financialData}
              />
            )}

            {activeTab === 'produtividade' && (
              <ProductivityView
                rows={byProfessional}
                baseMetrics={baseMetrics}
              />
            )}

            {activeTab === 'cobertura' && (
              <CoverageView
                rows={bySector}
              />
            )}

            {activeTab === 'risco' && (
              <RiskView
                rows={riskRows}
              />
            )}

            {activeTab === 'financeiro' && (
              <FinancialView
                data={financialData}
              />
            )}

            {activeTab === 'turnover' && (
              <CancellationView
                rows={cancellationRows}
              />
            )}

            {activeTab === 'auditoria' && (
              <GovernanceView
                reportId={reportId}
                version={reportVersion}
                status={reportStatus}
                hash={reportHash}
                hashLoading={hashLoading}
                auditEvents={auditEvents}
                onGenerateHash={
                  calculateReportHash
                }
                onStatusChange={
                  changeReportStatus
                }
                onNewVersion={
                  createNewVersion
                }
              />
            )}
          </section>
        </main>
      </div>

      {/* ========================================================
          MODAL DO RELATÓRIO
          ======================================================== */}

      {reportModalOpen && (
        <ReportPreviewModal
          reportPayload={reportPayload}
          reportHash={reportHash}
          hashLoading={hashLoading}
          reportStatus={reportStatus}
          reportVersion={reportVersion}
          onClose={() =>
            setReportModalOpen(false)
          }
          onPrint={printReport}
          onExport={exportCSV}
          onStatusChange={
            changeReportStatus
          }
          onNewVersion={createNewVersion}
        />
      )}
    </div>
  );
}

/* ============================================================
   SIDEBAR ITEM
   ============================================================ */

function SidebarItem({
  active,
  icon: Icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full
        flex
        items-center
        gap-3
        px-3
        py-3
        rounded-xl
        mb-1
        text-left
        transition-all
        group
        ${
          active
            ? 'bg-sky-600 text-white font-bold shadow-lg shadow-sky-950/20'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }
      `}
    >
      <Icon
        className={`
          w-[18px] h-[18px] shrink-0
          ${
            active
              ? 'text-white'
              : 'text-slate-500 group-hover:text-slate-300'
          }
        `}
      />

      <span className="text-sm font-medium flex-1">
        {label}
      </span>

      {active && (
        <ChevronRight className="w-4 h-4" />
      )}
    </button>
  );
}

/* ============================================================
   FILTER FIELD
   ============================================================ */

function FilterField({
  label,
  icon: Icon,
  children,
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
        {Icon && (
          <Icon className="w-3.5 h-3.5 text-sky-600" />
        )}
        {label}
      </label>

      {children}
    </div>
  );
}

/* ============================================================
   KPI CARD
   ============================================================ */

function KpiCard({
  icon: Icon,
  label,
  value,
  description,
  positive,
  warning,
}) {
  return (
    <Card className="p-5 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {label}
          </div>

          <div className="text-2xl font-bold text-slate-950 dark:text-slate-50 mt-2">
            {value}
          </div>
        </div>

        <div
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            ${
              warning
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                : positive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }
          `}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {description}
      </div>
    </Card>
  );
}

/* ============================================================
   EXECUTIVA
   ============================================================ */

function ExecutiveView({
  baseMetrics,
  riskRows,
  byProfessional,
  criticalAlerts,
  financialData,
}) {
  const topProfessionals =
    byProfessional.slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Resumo executivo
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Indicadores consolidados da operação
              </p>
            </div>

            <Activity className="w-5 h-5 text-slate-400" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ExecutiveMetric
              label="Cobertura"
              value={`${formatNumber(
                baseMetrics.coverage,
                1
              )}%`}
            />

            <ExecutiveMetric
              label="Horas"
              value={formatNumber(
                baseMetrics.confirmedHours,
                1
              )}
            />
            
            <ExecutiveMetric
              label="Custo Estimado"
              value={formatCurrency(
                financialData.estimatedCost
              )}
            />

            <ExecutiveMetric
              label="Cancelamentos"
              value={formatNumber(
                baseMetrics.canceled
              )}
            />
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="w-5 h-5 text-slate-700 dark:text-slate-300" />

            <h2 className="font-bold text-slate-900 dark:text-white">
              Situação operacional
            </h2>
          </div>

          <div className="space-y-4">
            <StatusLine
              label="Regular"
              value={
                riskRows.filter(
                  (row) =>
                    row.level === 'regular'
                ).length
              }
              type="success"
            />

            <StatusLine
              label="Atenção"
              value={
                riskRows.filter(
                  (row) =>
                    row.level === 'atencao'
                ).length
              }
              type="warning"
            />

            <StatusLine
              label="Crítico"
              value={
                riskRows.filter(
                  (row) =>
                    row.level === 'critico'
                ).length
              }
              type="danger"
            />
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-5 leading-relaxed">
            Classificação operacional baseada no percentual
            de registros confirmados. Não representa, por si só,
            uma conclusão de conformidade regulatória.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Cobertura por setor
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Menores percentuais aparecem primeiro
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {riskRows
              .slice(0, 8)
              .map((row) => (
                <CoverageBar
                  key={row.name}
                  label={row.name}
                  value={row.coverage}
                />
              ))}

            {riskRows.length === 0 && (
              <EmptyState
                title="Sem dados de cobertura"
                description="Não existem registros para os filtros atuais."
              />
            )}
          </div>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Profissionais por horas
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Maior volume de horas no período
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {topProfessionals.map(
              (row, index) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {row.name}
                    </div>

                    <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {row.category}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatNumber(
                      row.hours,
                      1
                    )}h
                  </div>
                </div>
              )
            )}

            {topProfessionals.length === 0 && (
              <EmptyState
                title="Sem profissionais"
                description="Não existem registros para os filtros atuais."
              />
            )}
          </div>
        </Card>
      </div>

      {criticalAlerts.length > 0 && (
        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500" />

            <h2 className="font-bold text-slate-900 dark:text-white">
              Alertas de gestão
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {criticalAlerts.map(
              (alert, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {alert.title}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {alert.description}
                  </div>
                </div>
              )
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   EXECUTIVE METRIC
   ============================================================ */

function ExecutiveMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className="text-xl font-bold mt-1 text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   STATUS LINE
   ============================================================ */

function StatusLine({
  label,
  value,
  type,
}) {
  const styles = {
    success:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    warning:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    danger:
      'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-300">
        {label}
      </span>

      <span
        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${styles[type]}`}
      >
        {formatNumber(value)}
      </span>
    </div>
  );
}

/* ============================================================
   COVERAGE BAR
   ============================================================ */

function CoverageBar({
  label,
  value,
}) {
  const numeric = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-3">
          {label}
        </span>

        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {formatNumber(numeric, 1)}%
        </span>
      </div>

      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-sky-600 transition-all"
          style={{
            width: `${numeric}%`,
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   PRODUTIVIDADE
   ============================================================ */

function ProductivityView({
  rows,
  baseMetrics,
}) {
  return (
    <ReportCard title="Produtividade por profissional" description="Carga horária e volume de plantões.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
              <th className="py-3 pr-4">
                Profissional
              </th>

              <th className="py-3 px-4">
                Categoria
              </th>

              <th className="py-3 px-4 text-right">
                Total
              </th>

              <th className="py-3 px-4 text-right">
                Confirmados
              </th>

              <th className="py-3 px-4 text-right">
                Pendentes
              </th>

              <th className="py-3 px-4 text-right">
                Cancelados
              </th>

              <th className="py-3 pl-4 text-right">
                Horas
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                  {row.name}
                </td>

                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                  {row.category}
                </td>

                <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                  {formatNumber(row.total)}
                </td>

                <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                  {formatNumber(
                    row.confirmed
                  )}
                </td>

                <td className="py-3 px-4 text-right text-amber-700 dark:text-amber-400">
                  {formatNumber(row.pending)}
                </td>

                <td className="py-3 px-4 text-right text-red-700 dark:text-red-400">
                  {formatNumber(
                    row.canceled
                  )}
                </td>

                <td className="py-3 pl-4 text-right font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(
                    row.hours,
                    1
                  )}h
                </td>
              </tr>
            ))}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-900 dark:text-slate-100">
                <td className="py-3 pr-4">
                  TOTAL
                </td>

                <td />

                <td className="py-3 px-4 text-right">
                  {formatNumber(
                    baseMetrics.total
                  )}
                </td>

                <td className="py-3 px-4 text-right">
                  {formatNumber(
                    baseMetrics.confirmed
                  )}
                </td>

                <td className="py-3 px-4 text-right">
                  {formatNumber(
                    baseMetrics.pending
                  )}
                </td>

                <td className="py-3 px-4 text-right">
                  {formatNumber(
                    baseMetrics.canceled
                  )}
                </td>

                <td className="py-3 pl-4 text-right">
                  {formatNumber(
                    baseMetrics.totalHours,
                    1
                  )}h
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {rows.length === 0 && (
        <EmptyState
          title="Nenhum registro encontrado"
          description="Ajuste os filtros para visualizar os dados."
        />
      )}
    </ReportCard>
  );
}

/* ============================================================
   COBERTURA
   ============================================================ */

function CoverageView({
  rows,
}) {
  return (
    <div className="space-y-5">
      <ReportCard title="Cobertura operacional por setor">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
          {rows.map((row) => (
            <CoverageBar
              key={row.name}
              label={row.name}
              value={row.coverage}
            />
          ))}
        </div>

        {rows.length === 0 && (
          <EmptyState
            title="Sem dados"
            description="Nenhum setor possui registros nos filtros selecionados."
          />
        )}
      </ReportCard>

      <ReportCard title="Detalhamento por setor">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">
                  Setor
                </th>
                <th className="py-3 px-4 text-right">
                  Total
                </th>
                <th className="py-3 px-4 text-right">
                  Confirmados
                </th>
                <th className="py-3 px-4 text-right">
                  Pendentes
                </th>
                <th className="py-3 px-4 text-right">
                  Cancelados
                </th>
                <th className="py-3 px-4 text-right">
                  Abertos
                </th>
                <th className="py-3 pl-4 text-right">
                  Cobertura
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                    {row.name}
                  </td>

                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                    {formatNumber(row.total)}
                  </td>

                  <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-medium">
                    {formatNumber(
                      row.confirmed
                    )}
                  </td>

                  <td className="py-3 px-4 text-right text-amber-700 dark:text-amber-400 font-medium">
                    {formatNumber(
                      row.pending
                    )}
                  </td>

                  <td className="py-3 px-4 text-right text-red-700 dark:text-red-400 font-medium">
                    {formatNumber(
                      row.canceled
                    )}
                  </td>

                  <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                    {formatNumber(row.open)}
                  </td>

                  <td className="py-3 pl-4 text-right font-bold text-slate-900 dark:text-slate-100">
                    {formatNumber(
                      row.coverage,
                      1
                    )}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCard>
    </div>
  );
}

/* ============================================================
   RISCO
   ============================================================ */

function RiskView({
  rows,
}) {
  return (
    <ReportCard
      title="Painel de risco operacional"
      description="Indicadores internos de cobertura e pendência."
    >
      <div className="mb-5 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 p-4 text-sm text-sky-900 dark:text-sky-100">
        <div className="flex gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />

          <div>
            <strong>
              Critério operacional:
            </strong>{' '}
            os níveis abaixo são indicadores gerenciais
            calculados a partir dos registros confirmados.
            Eles não constituem, isoladamente, parecer jurídico,
            regulatório ou clínico.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const levelConfig = {
            regular: {
              label: 'Regular',
              className:
                'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
            },

            atencao: {
              label: 'Atenção',
              className:
                'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
            },

            critico: {
              label: 'Crítico',
              className:
                'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
            },
          }[row.level];

          return (
            <div
              key={row.name}
              className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
            >
              <div className="flex-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {row.name}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {row.confirmed} confirmados de{' '}
                  {row.total} registros
                </div>
              </div>

              <div className="w-full md:w-64">
                <CoverageBar
                  label=""
                  value={row.coverage}
                />
              </div>

              <div
                className={`px-3 py-2 rounded-lg border text-xs font-bold text-center ${levelConfig.className}`}
              >
                {levelConfig.label}
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <EmptyState
          title="Sem dados de risco"
          description="Não há registros suficientes para calcular os indicadores."
        />
      )}
    </ReportCard>
  );
}

/* ============================================================
   FINANCEIRO
   ============================================================ */

function FinancialView({
  data,
}) {
  return (
    <div className="space-y-5">
      {data.missingRates > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />

          <div className="text-sm text-amber-900 dark:text-amber-200">
            <strong>
              Dados financeiros incompletos.
            </strong>{' '}
            {formatNumber(
              data.missingRates
            )}{' '}
            registro(s) não possuem valor/hora válido.
            Esses registros não foram incluídos no custo
            estimado.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          icon={BarChart3}
          label="Custo estimado"
          value={formatCurrency(
            data.estimatedCost
          )}
          description="Soma dos registros válidos"
        />

        <KpiCard
          icon={TrendingDown}
          label="Custo evitado"
          value={formatCurrency(
            data.canceledCost
          )}
          description="Valor de plantões cancelados"
          warning
        />

        <KpiCard
          icon={CheckCircle2}
          label="Com valor"
          value={formatNumber(
            data.knownRates
          )}
          description="Registros utilizados no cálculo"
          positive
        />

        <KpiCard
          icon={AlertTriangle}
          label="Sem valor"
          value={formatNumber(
            data.missingRates
          )}
          description="Não incluídos no cálculo"
          warning={data.missingRates > 0}
        />
      </div>

      <ReportCard title="Detalhamento financeiro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">
                  Profissional
                </th>

                <th className="py-3 px-4">
                  Setor
                </th>

                <th className="py-3 px-4 text-right">
                  Horas
                </th>

                <th className="py-3 px-4 text-right">
                  Valor/Hora
                </th>

                <th className="py-3 pl-4 text-right">
                  Custo
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
              {data.rows.map((row, index) => {
                const isCanceled = row.status === 'cancelado' || row.status === 'canceled';

                return (
                  <tr
                    key={`${row.professional}-${index}`}
                    className={`transition-colors ${
                      isCanceled
                        ? 'bg-red-50/30 hover:bg-red-50/50 dark:bg-red-900/10 dark:hover:bg-red-900/20'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className={`py-3 pr-4 font-medium ${isCanceled ? 'text-red-700 dark:text-red-400 line-through opacity-70' : 'text-slate-900 dark:text-slate-100'}`}>
                      {row.professional}
                      {isCanceled && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase">
                          Cancelado
                        </span>
                      )}
                    </td>

                    <td className={`py-3 px-4 ${isCanceled ? 'text-red-400 dark:text-red-500 line-through opacity-70' : 'text-slate-500 dark:text-slate-400'}`}>
                      {row.sector}
                    </td>

                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 dark:text-red-500 line-through opacity-70' : ''}`}>
                      {formatNumber(
                        row.hours,
                        1
                      )}
                    </td>

                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 dark:text-red-500 line-through opacity-70' : ''}`}>
                      {row.rate === null
                        ? '—'
                        : formatCurrency(
                            row.rate
                          )}
                    </td>

                    <td className={`py-3 pl-4 text-right font-semibold ${isCanceled ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {isCanceled 
                        ? 'Cancelado'
                        : (row.cost === null
                        ? '—'
                        : formatCurrency(
                            row.cost
                          ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.rows.length === 0 && (
          <EmptyState
            title="Sem dados financeiros"
            description="Não existem registros financeiros disponíveis nos filtros atuais."
          />
        )}
      </ReportCard>
    </div>
  );
}

/* ============================================================
   CANCELAMENTOS
   ============================================================ */

function CancellationView({
  rows,
}) {
  return (
    <ReportCard
      title="Cancelamentos registrados"
      description="Visão operacional dos registros classificados como cancelados."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
              <th className="py-3 pr-4">
                Data
              </th>

              <th className="py-3 px-4">
                Profissional
              </th>

              <th className="py-3 px-4">
                Setor
              </th>

              <th className="py-3 pl-4">
                Motivo
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
            {rows.map((row, index) => (
              <tr
                key={`${row.date}-${index}`}
                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 pr-4">
                  {formatDateBR(row.date)}
                </td>

                <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                  {row.professional}
                </td>

                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                  {row.sector}
                </td>

                <td className="py-3 pl-4 text-red-600 dark:text-red-400 font-medium">
                  {row.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <EmptyState
          title="Nenhum cancelamento"
          description="Não foram encontrados registros cancelados nos filtros atuais."
        />
      )}
    </ReportCard>
  );
}

/* ============================================================
   GOVERNANÇA
   ============================================================ */

function GovernanceView({
  reportId,
  version,
  status,
  hash,
  hashLoading,
  auditEvents,
  onGenerateHash,
  onStatusChange,
  onNewVersion,
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <GovernanceCard
          icon={FileCheck2}
          title="Status"
          value={status}
          description="Estado atual do documento"
        />

        <GovernanceCard
          icon={History}
          title="Versão"
          value={`v${version}`}
          description="Controle de versão"
        />

        <GovernanceCard
          icon={Hash}
          title="Integridade"
          value={
            hash
              ? 'Verificado'
              : 'Não calculado'
          }
          description="SHA-256 do conteúdo"
        />

        <GovernanceCard
          icon={ShieldCheck}
          title="Auditoria"
          value={formatNumber(
            auditEvents.length
          )}
          description="Eventos registrados nesta sessão"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                Governança do documento
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Controle do ciclo de vida do relatório.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              'Rascunho',
              'Em revisão',
              'Aprovado',
            ].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onStatusChange(option)
                }
                className={`
                  w-full
                  flex
                  items-center
                  justify-between
                  p-4
                  rounded-xl
                  border
                  text-left
                  transition-all
                  ${
                    status === option
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-300'
                  }
                `}
              >
                <span className="font-medium text-sm">
                  {option}
                </span>

                {status === option && (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4 gap-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onNewVersion}
          >
            <History className="w-4 h-4" />
            Criar nova versão
          </Button>
        </Card>

        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Hash className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                Integridade do relatório
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Identificador criptográfico do conteúdo.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 dark:bg-slate-900/50 border border-transparent dark:border-slate-800 p-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              ID
            </div>

            <div className="text-sm font-mono text-white mt-1 break-all">
              {reportId}
            </div>

            <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-4">
              SHA-256
            </div>

            <div className="text-xs font-mono text-slate-300 dark:text-slate-400 mt-1 break-all leading-relaxed">
              {hash ||
                'Hash ainda não calculado'}
            </div>
          </div>

          <Button
            type="button"
            className="w-full mt-4 gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold"
            onClick={onGenerateHash}
            disabled={hashLoading}
          >
            {hashLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Hash className="w-4 h-4" />
                Calcular SHA-256
              </>
            )}
          </Button>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
            O SHA-256 identifica o conteúdo utilizado na geração
            do relatório. Ele não representa assinatura digital,
            certificação ou aprovação jurídica.
          </p>
        </Card>
      </div>

      <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">
              Trilha de auditoria
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Eventos registrados durante esta sessão.
            </p>
          </div>

          <History className="w-5 h-5 text-slate-400" />
        </div>

        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {auditEvents.map((event) => (
            <div
              key={event.id}
              className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
            >
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {event.type}
                  </span>

                  <span className="text-[10px] text-slate-400">
                    {event.timestamp}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {event.description}
                </div>
              </div>
            </div>
          ))}

          {auditEvents.length === 0 && (
            <EmptyState
              title="Nenhum evento registrado"
              description="As interações com o relatório aparecerão nesta área."
            />
          )}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   GOVERNANCE CARD
   ============================================================ */

function GovernanceCard({
  icon: Icon,
  title,
  value,
  description,
}) {
  return (
    <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
            {title}
          </div>

          <div className="text-xl font-bold mt-2 text-slate-900 dark:text-slate-100">
            {value}
          </div>
        </div>

        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Icon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
        {description}
      </div>
    </Card>
  );
}

/* ============================================================
   REPORT CARD
   ============================================================ */

function ReportCard({
  title,
  description,
  children,
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
        <h2 className="font-bold text-base text-slate-900 dark:text-white">
          {title}
        </h2>

        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {description}
          </p>
        )}
      </div>

      <div className="p-6">
        {children}
      </div>
    </Card>
  );
}

/* ============================================================
   EMPTY
   ============================================================ */

function EmptyState({
  title,
  description,
}) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Search className="w-5 h-5 text-slate-400" />
      </div>

      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-4">
        {title}
      </h3>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   REPORT PREVIEW MODAL
   ============================================================ */

function ReportPreviewModal({
  reportPayload,
  reportHash,
  hashLoading,
  reportStatus,
  reportVersion,
  onClose,
  onPrint,
  onExport,
  onStatusChange,
  onNewVersion,
}) {
  const generatedAt =
    new Date().toLocaleString('pt-BR');

  return (
    <div
      className="report-print-overlay fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Pré-visualização do relatório"
    >
      <div className="report-print-shell w-full h-full max-w-[1500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* TOOLBAR */}
        <div className="report-no-print h-auto min-h-[68px] bg-slate-950 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>

            <div>
              <div className="font-semibold text-sm">
                Pré-visualização oficial
              </div>

              <div className="text-[11px] text-slate-400">
                {reportPayload.reportId} • v
                {reportVersion}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={reportStatus}
              onValueChange={onStatusChange}
            >
              <SelectTrigger className="w-[145px] bg-white/10 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="Rascunho">
                  Rascunho
                </SelectItem>

                <SelectItem value="Em revisão">
                  Em revisão
                </SelectItem>

                <SelectItem value="Aprovado">
                  Aprovado
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              onClick={onExport}
              className="gap-2 bg-transparent text-white border-white/20 hover:bg-white/10 hover:text-white"
            >
              <Download className="w-4 h-4" />
              CSV
            </Button>

            <Button
              type="button"
              onClick={onPrint}
              className="gap-2 bg-white text-slate-950 hover:bg-slate-100"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* REPORT SCROLL */}
        <div className="report-print-scroll flex-1 overflow-auto bg-slate-100 dark:bg-slate-800 p-3 sm:p-8">
          <div
            id="report-print-area"
            className="mx-auto w-[210mm] min-h-[297mm] bg-white shadow-xl px-[14mm] py-[13mm] text-slate-900"
          >
            {/* CABEÇALHO */}
            <div className="report-avoid-break">
              <div className="flex items-start justify-between gap-8 border-b-2 border-slate-950 pb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-white" />
                    </div>

                    <div>
                      <div className="text-[10px] font-bold tracking-[0.2em] uppercase">
                        Central de Inteligência
                      </div>

                      <div className="text-[10px] tracking-[0.1em] uppercase text-slate-500">
                        Hospitalar
                      </div>
                    </div>
                  </div>

                  <h1 className="text-2xl font-bold mt-7">
                    {reportPayload.title}
                  </h1>

                  <p className="text-sm text-slate-500 mt-1">
                    Documento gerencial consolidado
                  </p>
                </div>

                <div className="text-right text-[10px] text-slate-500 leading-relaxed">
                  <div>
                    <strong className="text-slate-700">
                      ID:
                    </strong>{' '}
                    {reportPayload.reportId}
                  </div>

                  <div>
                    <strong className="text-slate-700">
                      Versão:
                    </strong>{' '}
                    {reportVersion}
                  </div>

                  <div>
                    <strong className="text-slate-700">
                      Status:
                    </strong>{' '}
                    {reportStatus}
                  </div>

                  <div>
                    <strong className="text-slate-700">
                      Emissão:
                    </strong>{' '}
                    {generatedAt}
                  </div>
                </div>
              </div>

              {/* METADADOS */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    Instituição / Empresa
                  </div>

                  <div className="font-medium mt-1">
                    {reportPayload.companyId ||
                      'Não informado'}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    Unidade
                  </div>

                  <div className="font-medium mt-1">
                    {reportPayload.unitId ||
                      'Não informado'}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    Filtros aplicados
                  </div>

                  <div className="font-medium mt-1">
                    {reportPayload.filtersLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="mt-7 report-avoid-break">
              <div className="text-xs uppercase tracking-[0.15em] font-bold text-slate-400 mb-3">
                Indicadores principais
              </div>

              <div className="grid grid-cols-4 gap-3">
                <PrintKpi
                  label="Registros"
                  value={formatNumber(
                    reportPayload.kpis.total
                  )}
                />

                <PrintKpi
                  label="Confirmados"
                  value={formatNumber(
                    reportPayload.kpis.confirmed
                  )}
                />

                <PrintKpi
                  label="Horas"
                  value={formatNumber(
                    reportPayload.kpis.confirmedHours,
                    1
                  )}
                />

                <PrintKpi
                  label="Cobertura"
                  value={`${formatNumber(
                    reportPayload.kpis.coverage,
                    1
                  )}%`}
                />
              </div>
            </div>

            {/* TABELA */}
            <div className="mt-8">
              <div className="text-xs uppercase tracking-[0.15em] font-bold text-slate-400 mb-3">
                Dados do relatório
              </div>

              {reportPayload.rows.length > 0 ? (
                <table className="report-print-table w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-white">
                      {reportPayload.columns.map(
                        (column) => (
                          <th
                            key={column}
                            className="px-2 py-2 text-left font-bold border border-slate-950"
                          >
                            {column}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {reportPayload.rows.map(
                      (row, rowIndex) => {
                        const isCanceled =
                          row[row.length - 1] === 'Cancelado' ||
                          String(row).includes('CANCELADO');

                        return (
                          <tr
                            key={rowIndex}
                            className={
                              isCanceled
                                ? 'bg-red-50'
                                : rowIndex % 2 === 0
                                ? 'bg-white'
                                : 'bg-slate-50'
                            }
                          >
                            {row.map(
                              (value, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="px-2 py-2 border border-slate-200 align-top"
                                >
                                  {typeof value ===
                                  'number'
                                    ? formatNumber(
                                        value,
                                        Number.isInteger(
                                          value
                                        )
                                          ? 0
                                          : 2
                                      )
                                    : value}
                                </td>
                              )
                            )}
                          </tr>
                        );
                      }
                    )}
                  </tbody>

                  {reportPayload.totalsRow && (
                    <tfoot>
                      <tr className="font-bold bg-slate-100">
                        {reportPayload.totalsRow.map(
                          (value, index) => (
                            <td
                              key={index}
                              className="px-2 py-2 border border-slate-300"
                            >
                              {typeof value ===
                              'number'
                                ? formatNumber(
                                    value,
                                    Number.isInteger(
                                      value
                                    )
                                      ? 0
                                      : 2
                                  )
                                : value}
                            </td>
                          )
                        )}
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                <div className="border border-slate-200 rounded-lg p-10 text-center text-xs text-slate-500">
                  Não existem registros para os critérios
                  selecionados.
                </div>
              )}
            </div>

            {/* INTEGRIDADE */}
            <div className="mt-8 border-t border-slate-200 pt-5 report-avoid-break">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                    Integridade do documento
                  </div>

                  <div className="font-mono text-[8px] mt-2 break-all leading-relaxed">
                    {hashLoading
                      ? 'Calculando SHA-256...'
                      : reportHash ||
                        'Hash não calculado'}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                    Governança
                  </div>

                  <div className="text-[10px] mt-2">
                    Status atual:{' '}
                    <strong>
                      {reportStatus}
                    </strong>
                  </div>

                  <div className="text-[10px] mt-1">
                    Versão:{' '}
                    <strong>
                      {reportVersion}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ASSINATURA */}
            <div className="mt-10 grid grid-cols-2 gap-10 report-avoid-break">
              <div className="pt-10 border-t border-slate-400 text-center">
                <div className="text-xs font-semibold">
                  Responsável pela emissão
                </div>

                <div className="text-[10px] text-slate-400 mt-1">
                  Nome / cargo
                </div>
              </div>

              <div className="pt-10 border-t border-slate-400 text-center">
                <div className="text-xs font-semibold">
                  Revisão / aprovação
                </div>

                <div className="text-[10px] text-slate-400 mt-1">
                  Nome / cargo
                </div>
              </div>
            </div>

            {/* RODAPÉ */}
            <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between gap-6 text-[8px] text-slate-400">
              <div>
                Documento gerado pela Central de Inteligência
                Hospitalar.
              </div>

              <div className="text-right">
                {reportPayload.reportId} • v
                {reportVersion}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PRINT KPI
   ============================================================ */

function PrintKpi({
  label,
  value,
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
        {label}
      </div>

      <div className="text-base font-bold mt-1 text-slate-900">
        {value}
      </div>
    </div>
  );
}