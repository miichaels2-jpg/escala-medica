import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppData } from '@/lib/useAppData';
import { getMonthlySalaryForUnit, getProfessionalFinancialMeta, getShiftCostEstimate, safeFinancialNumber } from '@/lib/financialCalculations';
import { calculateProductivityPoolAllocations } from '@/lib/productivityCalculations';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DollarSign, Search, Receipt, Send, ChevronLeft, ChevronRight, FileText, Printer, Download, AlertTriangle
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  return safeFinancialNumber(val, fb);
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(val));
}

function roundCurrency(val) {
  return Math.round((safeNumber(val) + Number.EPSILON) * 100) / 100;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateBR(dateValue) {
  if (!dateValue) return '—';
  const parts = String(dateValue).split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateValue);
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getShiftSchedule(shift) {
  const dateParts = String(shift?.date || '').split('T')[0].split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some(part => !Number.isFinite(part))) return null;
  const [year, month, day] = dateParts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parseTime = (value, fallback) => {
    const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  };

  const startTime = parseTime(shift.start_time, '07:00');
  const endTime = parseTime(shift.end_time, '19:00');
  if (!startTime || !endTime) return null;

  const start = new Date(year, month - 1, day, startTime.hours, startTime.minutes);
  const end = new Date(year, month - 1, day, endTime.hours, endTime.minutes);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;
  if (end <= start) end.setDate(end.getDate() + 1);

  return { start, end, duration: (end.getTime() - start.getTime()) / 3_600_000 };
}

function isBillableShift(shift) {
  const status = normalizeText(shift?.status);
  const professionalName = normalizeText(shift?.professional_name || shift?.professional?.name || shift?.professionalName);
  if (!shift || status === 'cancelado' || status === 'vago' || status === 'vaga' || shift.is_open === true) return false;
  if (!shift.professional_id) return false;
  return !['vaga', 'aberto', 'descoberto', 'sem profissional', 'plantao sem profissional']
    .some(marker => professionalName.includes(marker));
}

function getProfessionalMeta(professional) {
  return getProfessionalFinancialMeta(professional);
}

function getStoredProductivityAttendance(professional, unitId, date) {
  const stored = getProfessionalMeta(professional)
    .daily_productivity_attendance?.[String(unitId)]?.[String(date)];
  const rawCount = typeof stored === 'object' && stored !== null ? stored.count : stored;
  if (rawCount === null || rawCount === undefined || rawCount === '') return null;
  const count = Number(rawCount);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function isProductivityProfessional(professional) {
  const meta = getProfessionalMeta(professional);
  return ['produtividade', 'production'].includes(normalizeText(
    meta.remuneration_type || professional?.remuneration_type || ''
  ));
}

function getSpreadsheetDate(value, fallbackDate) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10);
  }
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;
  return fallbackDate;
}

function getSpreadsheetCellValue(cell) {
  const value = cell?.value;
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
    if ('text' in value) return value.text;
  }
  return value;
}

function getPaymentStatusKey(unitId, professionalId, monthPrefix) {
  return `${unitId}_${professionalId}_${monthPrefix}`;
}

export default function Faturamento() {
  const { shifts = [], professionals = [], sectors = [], company, selectedUnitId, units = [], isManager, syncGlobalData } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfModal, setSelectedProfModal] = useState(null);
  const [productivityUnitDraft, setProductivityUnitDraft] = useState('');
  const [productivityConfigSaving, setProductivityConfigSaving] = useState(false);
  const [productionEntryOpen, setProductionEntryOpen] = useState(false);
  const [productionDate, setProductionDate] = useState(() => getLocalDateString());
  const [productionDraft, setProductionDraft] = useState({});
  const [productionSaving, setProductionSaving] = useState(false);
  const [productionImporting, setProductionImporting] = useState(false);
  const [productionError, setProductionError] = useState('');
  const productivityFileInputRef = useRef(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const [pagamentosStatus, setPagamentosStatus] = useState(() => {
    try { 
      const stored = window.localStorage.getItem('scale_faturamento_pagos');
      const parsed = stored ? JSON.parse(stored) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn('Não foi possível carregar os status de pagamento locais:', error);
      return {};
    }
  });

  useEffect(() => {
    const mappings = units.filter(unit => unit.id && unit.legacy_id &&
      String(unit.id) !== String(unit.legacy_id));
    if (mappings.length === 0) return;

    const nextState = { ...pagamentosStatus };
    let changed = false;
    mappings.forEach(unit => {
      const oldPrefix = `${unit.legacy_id}_`;
      Object.keys(nextState).filter(key => key.startsWith(oldPrefix)).forEach(oldKey => {
        const newKey = `${unit.id}_${oldKey.slice(oldPrefix.length)}`;
        nextState[newKey] = Boolean(nextState[newKey] || nextState[oldKey]);
        delete nextState[oldKey];
        changed = true;
      });
    });
    if (!changed) return;

    try {
      window.localStorage.setItem('scale_faturamento_pagos', JSON.stringify(nextState));
      setPagamentosStatus(nextState);
    } catch (error) {
      console.warn('Não foi possível atualizar os status locais de pagamento para os UUIDs hospitalares:', error);
    }
  }, [units, pagamentosStatus]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const todayStr = getLocalDateString(now);

  const currentUnitObj = units.find(u => String(u.id) === String(selectedUnitId));
  const currentUnitName = currentUnitObj?.name || company?.name || 'Hospital Principal';
  const productivityRule = company?.data?.productivity_pool_rule || null;
  const productivityRuleUnitId = productivityRule?.unit_id ? String(productivityRule.unit_id) : '';
  const isProductivityPoolUnit = Boolean(productivityRuleUnitId && productivityRuleUnitId === String(selectedUnitId));

  useEffect(() => {
    setProductivityUnitDraft(productivityRuleUnitId);
  }, [company?.id, productivityRuleUnitId]);

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  const productivityProfessionalsById = useMemo(() => {
    const map = new Map();
    professionals.forEach(professional => {
      if (professional?.id && isProductivityProfessional(professional)) {
        map.set(String(professional.id), professional);
      }
    });
    return map;
  }, [professionals]);

  const productionEntryRows = useMemo(() => {
    if (!isProductivityPoolUnit || String(selectedUnitId) !== productivityRuleUnitId) return [];
    const byProfessional = new Map();
    shifts.forEach(shift => {
      if (!shift || String(shift.unit_id) !== String(selectedUnitId) ||
        String(shift.date || '').split('T')[0] !== productionDate || !isBillableShift(shift)) return;
      const professional = productivityProfessionalsById.get(String(shift.professional_id));
      if (!professional) return;
      const key = String(professional.id);
      const row = byProfessional.get(key) || { professional, shiftCount: 0 };
      row.shiftCount += 1;
      byProfessional.set(key, row);
    });
    return [...byProfessional.values()].sort((a, b) => (a.professional.name || '').localeCompare(b.professional.name || ''));
  }, [isProductivityPoolUnit, productivityRuleUnitId, selectedUnitId, productionDate, shifts, productivityProfessionalsById]);

  useEffect(() => {
    if (!productionEntryOpen) return;
    setProductionDraft(Object.fromEntries(productionEntryRows.map(({ professional }) => [
      String(professional.id),
      String(getStoredProductivityAttendance(professional, selectedUnitId, productionDate) ?? '')
    ])));
    setProductionError('');
  }, [productionEntryOpen, productionDate, selectedUnitId, productionEntryRows]);

  const productivityAllocations = useMemo(() => {
    if (!isProductivityPoolUnit || !productivityRuleUnitId) {
      return calculateProductivityPoolAllocations([], 150);
    }

    const recordsByProfessionalDay = new Map();
    shifts.forEach(shift => {
      if (!shift || String(shift.unit_id) !== productivityRuleUnitId ||
        !String(shift.date || '').startsWith(monthPrefix) || !isBillableShift(shift)) return;
      const professionalId = String(shift.professional_id);
      const professional = productivityProfessionalsById.get(professionalId);
      if (!professional) return;
      const schedule = getShiftSchedule(shift);
      if (!schedule) return;
      const status = normalizeText(shift.status);
      const date = String(shift.date).split('T')[0];
      if (date > todayStr) return;
      const isCompleted = ['realizado', 'concluido', 'concluida'].includes(status) || schedule.end <= now;
      const id = `${date}:${professionalId}`;
      const existing = recordsByProfessionalDay.get(id);
      if (existing) {
        if (!isCompleted) existing.attendance_count = null;
        return;
      }
      recordsByProfessionalDay.set(id, {
        id,
        date,
        professional_id: professionalId,
        attendance_count: isCompleted && professional
          ? getStoredProductivityAttendance(professional, productivityRuleUnitId, date)
          : null
      });
    });

    return calculateProductivityPoolAllocations(
      [...recordsByProfessionalDay.values()],
      safeNumber(productivityRule?.daily_amount, 150)
    );
  }, [isProductivityPoolUnit, productivityRuleUnitId, productivityRule?.daily_amount, shifts, monthPrefix, todayStr, now, productivityProfessionalsById]);

  useEffect(() => {
    if (professionals.length === 0) return;
    const migratedStatus = { ...pagamentosStatus };
    let changed = false;

    professionals.forEach(professional => {
      if (!professional?.id) return;
      const meta = getProfessionalMeta(professional);
      const primaryUnitId = professional.unit_id || meta.allowed_unit_ids?.[0] || professional.unit_ids?.[0];
      if (!primaryUnitId) return;
      const legacyPrefix = `${professional.id}_`;
      Object.keys(migratedStatus).forEach(legacyKey => {
        if (!legacyKey.startsWith(legacyPrefix)) return;
        const month = legacyKey.slice(legacyPrefix.length);
        if (!/^\d{4}-\d{2}$/.test(month)) return;

        const scopedKey = getPaymentStatusKey(primaryUnitId, professional.id, month);
        if (!Object.prototype.hasOwnProperty.call(migratedStatus, scopedKey)) {
          migratedStatus[scopedKey] = migratedStatus[legacyKey];
        }
        delete migratedStatus[legacyKey];
        changed = true;
      });
    });

    if (changed) {
      setPagamentosStatus(migratedStatus);
      try {
        window.localStorage.setItem('scale_faturamento_pagos', JSON.stringify(migratedStatus));
      } catch (error) {
        console.warn('Não foi possível migrar os status de pagamento para as unidades:', error);
      }
    }
  }, [professionals, pagamentosStatus]);

  const handleTogglePago = (profId) => {
    const item = reportData.find(summary => String(summary.prof.id) === String(profId));
    if (item?.awaitingProduction && !item.isPago) {
      alert('Não é possível marcar como pago enquanto houver plantões por produtividade sem apuração registrada.');
      return;
    }
    setPagamentosStatus(prev => {
      const key = getPaymentStatusKey(selectedUnitId, profId, monthPrefix);
      const nextState = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem('scale_faturamento_pagos', JSON.stringify(nextState));
      } catch (error) {
        console.warn('Não foi possível salvar o status de pagamento neste navegador:', error);
      }
      return nextState;
    });
  };

  const handleSaveProductivityConfiguration = async () => {
    if (!isManager) return;
    if (!company?.id) {
      alert('A empresa não foi identificada. Atualize os dados e tente novamente.');
      return;
    }
    if (productivityUnitDraft && !units.some(unit => String(unit.id) === String(productivityUnitDraft))) {
      alert('Selecione uma unidade válida para a regra de produtividade.');
      return;
    }
    if (productivityUnitDraft && productivityRuleUnitId &&
      String(productivityUnitDraft) !== productivityRuleUnitId &&
      !confirm('A regra diária de R$ 150 será transferida para outra unidade. Deseja continuar?')) return;

    setProductivityConfigSaving(true);
    try {
      const companyData = company.data && typeof company.data === 'object' && !Array.isArray(company.data)
        ? company.data
        : {};
      const nextData = { ...companyData };
      if (productivityUnitDraft) {
        nextData.productivity_pool_rule = {
          unit_id: String(productivityUnitDraft),
          daily_amount: 150
        };
      } else {
        delete nextData.productivity_pool_rule;
      }
      const { error } = await supabase.from('companies').update({ data: nextData }).eq('id', company.id);
      if (error) throw error;
      await syncGlobalData();
      alert(productivityUnitDraft
        ? `Regra de produtividade de R$ 150 por dia ativada para ${units.find(unit => String(unit.id) === String(productivityUnitDraft))?.name}.`
        : 'Regra de produtividade diária desativada.');
    } catch (error) {
      console.error('Falha ao salvar a configuração de produtividade diária:', error);
      alert(`A configuração não foi salva. ${error?.message || 'Verifique a conexão e tente novamente.'}`);
    } finally {
      setProductivityConfigSaving(false);
    }
  };

  const handleDownloadProductivityTemplate = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Atendimentos diários');
      worksheet.columns = [
        { header: 'PROFISSIONAL', key: 'professional', width: 34 },
        { header: 'QTD ATENDIMENTO', key: 'attendance', width: 20 },
        { header: 'ESCALA', key: 'schedule', width: 22 },
        { header: 'DATA', key: 'date', width: 16 },
        { header: 'ID PROFISSIONAL', key: 'id', width: 34 },
        { header: 'VALOR RATEADO (R$)', key: 'amount', width: 22 }
      ];
      productionEntryRows.forEach(({ professional, shiftCount }, index) => {
        const rowNumber = index + 2;
        const row = worksheet.addRow({
          professional: professional.name,
          attendance: null,
          schedule: `${shiftCount} plantão(ões)`,
          date: new Date(`${productionDate}T12:00:00`),
          id: String(professional.id),
          amount: { formula: `IFERROR(B${rowNumber}*150/SUM(B$2:B$${productionEntryRows.length + 1}),0)` }
        });
        row.getCell(4).numFmt = 'dd/mm/yyyy';
        row.getCell(6).numFmt = '"R$" #,##0.00';
      });
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Atendimentos_${productionDate}_${String(selectedUnitId).replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Falha ao gerar o modelo Excel de produtividade:', error);
      alert(`Não foi possível gerar o modelo Excel. ${error?.message || 'Tente novamente.'}`);
    }
  };

  const handleImportProductivityWorkbook = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setProductionError('Use um arquivo .xlsx. Arquivos .xls antigos não são compatíveis.');
      return;
    }

    setProductionImporting(true);
    setProductionError('');
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('O arquivo não contém uma planilha.');

      let headerRowNumber = 0;
      let columns = {};
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (headerRowNumber) return;
        const found = {};
        row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
          const header = normalizeText(getSpreadsheetCellValue(cell));
          if (header.includes('profissional') && !header.includes('id')) found.professional = columnNumber;
          if (header.includes('qtd') && (header.includes('atendimento') || header.includes('atendimentos'))) found.attendance = columnNumber;
          if (header.includes('data')) found.date = columnNumber;
          if (header.includes('id') && header.includes('profissional')) found.professionalId = columnNumber;
        });
        if (found.professional && found.attendance) {
          headerRowNumber = rowNumber;
          columns = found;
        }
      });
      if (!headerRowNumber) throw new Error('Não encontrei os cabeçalhos PROFISSIONAL e QTD ATENDIMENTO.');

      const currentById = new Map(productionEntryRows.map(({ professional }) => [String(professional.id), professional]));
      const currentByName = new Map();
      productionEntryRows.forEach(({ professional }) => {
        const name = normalizeText(professional.name);
        const matches = currentByName.get(name) || [];
        matches.push(professional);
        currentByName.set(name, matches);
      });

      const imported = {};
      const errors = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return;
        const name = String(getSpreadsheetCellValue(row.getCell(columns.professional)) || '').trim();
        if (!name) return;
        const countValue = getSpreadsheetCellValue(row.getCell(columns.attendance));
        const countString = String(countValue ?? '').trim();
        const dateValue = columns.date ? getSpreadsheetCellValue(row.getCell(columns.date)) : null;
        const rowDate = getSpreadsheetDate(dateValue, productionDate);
        const idValue = columns.professionalId
          ? String(getSpreadsheetCellValue(row.getCell(columns.professionalId)) || '').trim()
          : '';
        let professional = idValue ? currentById.get(idValue) : null;
        if (!professional) {
          const matches = currentByName.get(normalizeText(name)) || [];
          professional = matches.length === 1 ? matches[0] : null;
          if (matches.length > 1) errors.push(`${name}: nome duplicado; inclua o ID PROFISSIONAL.`);
        }
        if (!professional) {
          errors.push(`${name}: profissional não escalado na unidade/data selecionada.`);
          return;
        }
        if (rowDate !== productionDate) {
          errors.push(`${name}: a data ${formatDateBR(rowDate)} não corresponde à data selecionada ${formatDateBR(productionDate)}.`);
          return;
        }
        if (!/^\d+$/.test(countString) || !Number.isSafeInteger(Number(countString))) {
          errors.push(`${name}: quantidade de atendimentos inválida.`);
          return;
        }
        const professionalId = String(professional.id);
        if (Object.prototype.hasOwnProperty.call(imported, professionalId)) {
          errors.push(`${name}: profissional repetido no arquivo.`);
          return;
        }
        imported[professionalId] = countString;
      });

      if (Object.keys(imported).length === 0 && errors.length === 0) {
        throw new Error('O arquivo não contém linhas de produção para importar.');
      }
      if (errors.length > 0) {
        setProductionError(`Nenhuma linha foi aplicada. ${errors.slice(0, 8).join(' ')}`);
        return;
      }
      setProductionDraft(previous => ({ ...previous, ...imported }));
      setProductionError(`${Object.keys(imported).length} registro(s) importado(s) para conferência. Revise os valores e clique em Salvar atendimentos.`);
    } catch (error) {
      console.error('Falha ao importar a planilha de produtividade:', error);
      setProductionError(`Não foi possível importar a planilha. ${error?.message || 'Confira o arquivo e tente novamente.'}`);
    } finally {
      setProductionImporting(false);
    }
  };

  const handleSaveDailyProduction = async () => {
    if (!isManager || !isProductivityPoolUnit) return;
    if (productionEntryRows.length === 0) {
      setProductionError('Não há profissionais com plantão na unidade nesta data.');
      return;
    }
    const attendanceRows = productionEntryRows.map(({ professional }) => {
      const rawCount = productionDraft[String(professional.id)] ?? '';
      return { professional, rawCount, count: /^\d+$/.test(String(rawCount).trim()) ? Number(rawCount) : null };
    });
    const invalidRows = attendanceRows.filter(row => row.count === null || !Number.isSafeInteger(row.count));
    if (invalidRows.length > 0) {
      setProductionError(`Informe um número inteiro igual ou maior que zero para: ${invalidRows.map(row => row.professional.name).join(', ')}.`);
      return;
    }

    setProductionSaving(true);
    setProductionError('');
    try {
      const updatedAt = new Date().toISOString();
      const results = await Promise.all(attendanceRows.map(async ({ professional, count }) => {
        const profileData = professional.data && typeof professional.data === 'object' && !Array.isArray(professional.data)
          ? professional.data
          : {};
        const attendanceByUnit = profileData.daily_productivity_attendance &&
          typeof profileData.daily_productivity_attendance === 'object' &&
          !Array.isArray(profileData.daily_productivity_attendance)
          ? profileData.daily_productivity_attendance
          : {};
        const unitRecords = attendanceByUnit[String(selectedUnitId)] &&
          typeof attendanceByUnit[String(selectedUnitId)] === 'object' &&
          !Array.isArray(attendanceByUnit[String(selectedUnitId)])
          ? attendanceByUnit[String(selectedUnitId)]
          : {};
        const data = {
          ...profileData,
          daily_productivity_attendance: {
            ...attendanceByUnit,
            [String(selectedUnitId)]: {
              ...unitRecords,
              [productionDate]: { count, updated_at: updatedAt }
            }
          }
        };
        const { error } = await supabase.from('professionals').update({ data }).eq('id', professional.id);
        return { professional, error };
      }));
      const failed = results.filter(result => result.error);
      await syncGlobalData();
      if (failed.length > 0) {
        console.error('Falha ao salvar uma parte dos registros de produtividade:', failed.map(result => result.error));
        setProductionError(
          `${results.length - failed.length} registro(s) foram salvos; falharam: ${failed.map(result => result.professional.name).join(', ')}. Confira e tente salvar novamente.`
        );
        return;
      }
      setProductionEntryOpen(false);
      alert(`Atendimentos de ${formatDateBR(productionDate)} salvos para ${attendanceRows.length} profissional(is).`);
    } catch (error) {
      console.error('Falha ao salvar os atendimentos diários:', error);
      setProductionError(`Não foi possível salvar os atendimentos. ${error?.message || 'Verifique a conexão e tente novamente.'}`);
    } finally {
      setProductionSaving(false);
    }
  };

  const reportData = useMemo(() => {
    const profsSummary = {};

    (professionals || []).forEach(p => {
      if (!p) return;
      const meta = getProfessionalMeta(p);

      const remunType = isProductivityPoolUnit && isProductivityProfessional(p)
        ? 'produtividade'
        : normalizeText(meta.remuneration_type || p.remuneration_type || 'plantao');
      const unitRates = meta.unit_rates || {};
      const legacySalary = safeNumber(meta.monthly_salary !== undefined ? meta.monthly_salary : p.monthly_salary, 0);
      const primaryUnitId = p.unit_id || meta.allowed_unit_ids?.[0] || p.unit_ids?.[0];
      const monthlySalary = getMonthlySalaryForUnit(p, selectedUnitId);
      const isMonthly = ['mensal', 'monthly', 'salario mensal'].includes(remunType);
      const isPrimaryUnit = String(primaryUnitId) === String(selectedUnitId);
      const salaryBase = isMonthly ? monthlySalary.value : legacySalary;
      const assignedUnitIds = Array.isArray(meta.allowed_unit_ids)
        ? meta.allowed_unit_ids
        : Array.isArray(p.unit_ids) ? p.unit_ids : (p.unit_id ? [p.unit_id] : []);
      const isAssignedToCurrentUnit = assignedUnitIds.some(unitId => String(unitId) === String(selectedUnitId)) || isPrimaryUnit;
      const taxRate = meta.coop_tax_rate ?? p.coop_tax_rate ?? 0;
      const matricula = meta.registration_id || p.registration_id || 'MAT-XXXX';
      const chavePix = (meta.pix_key || p.pix_key || '').trim();
      const pixTipo = meta.pix_type || p.pix_type || 'CPF';
      const banco = (meta.bank_info || p.bank_info || '').trim();

      profsSummary[String(p.id)] = {
        prof: p,
        profStatus: normalizeText(p.status || meta.status || 'ativo'),
        isAssignedToCurrentUnit,
        matricula,
        chavePix,
        pixTipo,
        banco,
        remunType,
        salarioBaseContratual: salaryBase,
        monthlySalaryMissing: isMonthly && monthlySalary.missing,
        unitRates,
        taxRate: safeNumber(taxRate),
        plantõesRealizados: 0,
        horasRealizadas: 0,
        atendimentosApurados: 0,
        valorApuradoPlantões: 0, // Novo acumulador
        plantõesSemTarifa: 0,
        plantõesAguardandoProducao: 0,
        plantõesFuturos: 0,
        plantõesList: []
      };
    });

    const productivityPayoutDisplayed = new Set();
    const productivityAttendanceDisplayed = new Set();
    const productivityDaysAwaitingInput = new Set();
    (shifts || []).forEach(shift => {
      if (!shift) return;
      if (String(shift.unit_id) !== String(selectedUnitId)) return;
      const shiftDate = String(shift.date || '').split('T')[0];
      if (!shiftDate.startsWith(monthPrefix) || !isBillableShift(shift)) return;

      const pId = String(shift.professional_id);
      if (profsSummary[pId]) {
        const schedule = getShiftSchedule(shift);
        if (!schedule) return;
        const status = normalizeText(shift.status);
        const isRealizado = ['realizado', 'concluido', 'concluida'].includes(status) || schedule.end <= now;
        const profRef = profsSummary[pId];

        let valorDoPlantaoAtual = 0;
        let tarifaPendente = false;
        const remunerationEstimate = getShiftCostEstimate({
          ...profRef.prof,
          remuneration_type: profRef.remunType
        }, {
          ...shift,
          duration_hours: schedule.duration
        });

        if (isRealizado) {
          profRef.plantõesRealizados += 1;
          profRef.horasRealizadas += Math.round(schedule.duration * 10) / 10;
          if (remunerationEstimate.requiresProduction) {
            const dailyKey = `${shiftDate}:${pId}`;
            const countKey = `${shiftDate}:${pId}`;
            const dayIsIncomplete = !isProductivityPoolUnit ||
              productivityAllocations.incompleteDates.has(shiftDate);
            if (dayIsIncomplete && !productivityDaysAwaitingInput.has(countKey)) {
              productivityDaysAwaitingInput.add(countKey);
              profRef.plantõesAguardandoProducao += 1;
            }
            if (!dayIsIncomplete && !productivityPayoutDisplayed.has(dailyKey)) {
              const dailyAmount = productivityAllocations.allocationsByDateAndProfessional.get(dailyKey) || 0;
              valorDoPlantaoAtual = dailyAmount;
              profRef.valorApuradoPlantões += dailyAmount;
              productivityPayoutDisplayed.add(dailyKey);
            }
            if (!dayIsIncomplete && !productivityAttendanceDisplayed.has(dailyKey)) {
              profRef.atendimentosApurados += getStoredProductivityAttendance(
                profRef.prof,
                selectedUnitId,
                shiftDate
              ) || 0;
              productivityAttendanceDisplayed.add(dailyKey);
            }
          } else if (!['mensal', 'monthly', 'salario mensal'].includes(profRef.remunType)) {
            valorDoPlantaoAtual = remunerationEstimate.amount;
            tarifaPendente = remunerationEstimate.missingRate;
            profRef.valorApuradoPlantões += valorDoPlantaoAtual;
            if (tarifaPendente) profRef.plantõesSemTarifa += 1;
          }
        } else {
          profRef.plantõesFuturos += 1;
        }

        profRef.plantõesList.push({
          ...shift,
          duration: Math.round(schedule.duration * 10) / 10,
          valorAplicado: valorDoPlantaoAtual,
          tarifaPendente,
          aguardandoProducao: isRealizado && remunerationEstimate.requiresProduction &&
            (!isProductivityPoolUnit || productivityAllocations.incompleteDates.has(shiftDate)),
          atendimentoDia: remunerationEstimate.requiresProduction
            ? getStoredProductivityAttendance(profRef.prof, selectedUnitId, shiftDate)
            : null,
          isRealizado
        });
      }
    });

    return Object.values(profsSummary).map(item => {
      let valorBrutoTotal = 0;

      if (monthPrefix > todayStr.substring(0, 7)) {
        valorBrutoTotal = 0;
      } else {
        if (['mensal', 'monthly', 'salario mensal'].includes(item.remunType)) {
          valorBrutoTotal = item.salarioBaseContratual;
        } else if (['produtividade', 'production'].includes(item.remunType)) {
          valorBrutoTotal = item.valorApuradoPlantões;
        } else {
          // 'plantao': O bruto é a soma exata do que foi apurado no laço acima
          valorBrutoTotal = item.valorApuradoPlantões;
        }
      }

      valorBrutoTotal = roundCurrency(valorBrutoTotal);
      const valorDesconto = roundCurrency((valorBrutoTotal * item.taxRate) / 100);
      const valorLiquido = roundCurrency(valorBrutoTotal - valorDesconto);
      const isPago = pagamentosStatus[getPaymentStatusKey(selectedUnitId, item.prof.id, monthPrefix)] || false;

      return {
        ...item,
        valorBruto: valorBrutoTotal,
        valorDesconto,
        valorLiquido,
        isPago,
        awaitingProduction: item.plantõesAguardandoProducao > 0
      };
    }).filter(item =>
      item.plantõesRealizados > 0 ||
      item.plantõesFuturos > 0 ||
      (['mensal', 'monthly', 'salario mensal'].includes(item.remunType) && item.profStatus === 'ativo' && item.isAssignedToCurrentUnit)
    );
  }, [professionals, shifts, monthPrefix, selectedUnitId, pagamentosStatus, todayStr, now, productivityAllocations, isProductivityPoolUnit]);

  const filteredReport = useMemo(() => {
    const term = normalizeText(searchQuery);
    return reportData.filter(item => {
      if (!term) return true;
      const nome = normalizeText(item.prof.name);
      const doc = normalizeText(item.prof.document);
      const mat = normalizeText(item.matricula);
      return nome.includes(term) || doc.includes(term) || mat.includes(term);
    });
  }, [reportData, searchQuery]);

  const filteredTotals = useMemo(() => filteredReport.reduce((summary, item) => ({
    bruto: summary.bruto + item.valorBruto,
    liquido: summary.liquido + item.valorLiquido,
    plantões: summary.plantões + item.plantõesRealizados,
    atendimentos: summary.atendimentos + item.atendimentosApurados,
    horas: summary.horas + item.horasRealizadas
  }), { bruto: 0, liquido: 0, plantões: 0, atendimentos: 0, horas: 0 }), [filteredReport]);

  const shiftsWithoutProfessional = useMemo(() => {
    const professionalIds = new Set((professionals || []).map(prof => String(prof?.id)));
    return (shifts || []).filter(shift => {
      const shiftDate = String(shift?.date || '').split('T')[0];
      return shift &&
        String(shift.unit_id) === String(selectedUnitId) &&
        shiftDate.startsWith(monthPrefix) &&
        isBillableShift(shift) &&
        !professionalIds.has(String(shift.professional_id));
    }).length;
  }, [professionals, shifts, monthPrefix, selectedUnitId]);

  const shiftsWithInvalidSchedule = useMemo(() => (shifts || []).filter(shift => {
    const shiftDate = String(shift?.date || '').split('T')[0];
    return shift &&
      String(shift.unit_id) === String(selectedUnitId) &&
      shiftDate.startsWith(monthPrefix) &&
      isBillableShift(shift) &&
      !getShiftSchedule(shift);
  }).length, [shifts, monthPrefix, selectedUnitId]);

  const shiftsWithoutRate = reportData.reduce((total, item) => total + item.plantõesSemTarifa, 0);
  const shiftsAwaitingProduction = reportData.reduce((total, item) => total + item.plantõesAguardandoProducao, 0);
  const professionalsWithoutMonthlySalary = reportData.filter(item => item.monthlySalaryMissing).length;
  const paymentSummary = useMemo(() => reportData.reduce((summary, item) => {
    if (item.awaitingProduction) {
      summary.awaiting.count += 1;
      return summary;
    }
    const bucket = item.isPago ? 'paid' : 'pending';
    summary[bucket].count += 1;
    summary[bucket].net += item.valorLiquido;
    return summary;
  }, { paid: { count: 0, net: 0 }, pending: { count: 0, net: 0 }, awaiting: { count: 0 } }), [reportData]);

  const totals = useMemo(() => {
    let bruto = 0, liquido = 0, plantões = 0, horas = 0;
    reportData.forEach(i => {
      bruto += i.valorBruto;
      liquido += i.valorLiquido;
      plantões += i.plantõesRealizados;
      horas += i.horasRealizadas;
    });
    return { bruto, liquido, plantões, horas };
  }, [reportData]);

  // =========================================================================
  // EXPORTAÇÃO EXCEL NATIVA (COM ESTILOS CONTÁBEIS E DE TEMPO)
  // =========================================================================
  const handleExportExcel = () => {
    if (filteredReport.length === 0) return alert('Não há dados para exportar neste mês.');

    const hospitalName = currentUnitName;
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR');

    const formatHourForExcel = (num) => {
      const h = Math.floor(safeNumber(num));
      const m = Math.round((safeNumber(num) - h) * 60);
      return `${h}:${String(m).padStart(2, '0')}`;
    };

    const rowsHtml = filteredReport.map(item => {
      const formaPagamento = item.chavePix ? `PIX (${item.pixTipo}): ${item.chavePix}` : (item.banco ? `Banco: ${item.banco}` : 'Pendente de Cadastro');
      const regime = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Produtividade' : 'Por Plantão (Tabela)';

      return `
        <tr>
          <td style="border: 1px solid #cbd5e1;">${item.prof.name}</td>
          <td style="border: 1px solid #cbd5e1; mso-number-format:'\\@';">${item.matricula}</td>
          <td style="border: 1px solid #cbd5e1;">${item.prof.specialty || 'Geral'}</td>
          <td style="border: 1px solid #cbd5e1;">${regime}</td>
          <td class="num" style="border: 1px solid #cbd5e1;">${item.plantõesRealizados}</td>
          <td class="num" style="border: 1px solid #cbd5e1;">${item.remunType === 'produtividade' ? item.atendimentosApurados : ''}</td>
          <td class="time" style="border: 1px solid #cbd5e1;">${formatHourForExcel(item.horasRealizadas)}</td>
          <td class="money" style="border: 1px solid #cbd5e1;">${item.valorBruto.toFixed(2).replace('.', ',')}</td>
          <td class="money" style="border: 1px solid #cbd5e1; color: #ef4444;">${item.valorDesconto.toFixed(2).replace('.', ',')}</td>
          <td class="money" style="border: 1px solid #cbd5e1; font-weight: bold; color: #059669;">${item.valorLiquido.toFixed(2).replace('.', ',')}</td>
          <td style="border: 1px solid #cbd5e1; mso-number-format:'\\@';">${formaPagamento}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${item.awaitingProduction ? '#b45309' : item.isPago ? '#059669' : '#f59e0b'};">${item.awaitingProduction ? 'Apuração pendente · saldo parcial' : item.isPago ? 'PAGO' : 'Pendente'}</td>
        </tr>
      `;
    }).join('');

    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th { background-color: #1e293b; color: #ffffff; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; padding: 10px; }
          td { padding: 6px; vertical-align: middle; }
          .money { mso-number-format: "_-\\[\\$R\\$-pt-BR\\]\\* \\#\\,\\#\\#0\\.00_-"; text-align: right; }
          .time { mso-number-format: "\\[h\\]\\:mm"; text-align: center; font-weight: bold; }
          .num { mso-number-format: "0"; text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="12" style="font-size: 20px; font-weight: bold; text-align: center; background-color: #0f172a; color: #ffffff; padding: 12px;">${hospitalName}</td>
          </tr>
          <tr>
            <td colspan="12" style="font-size: 14px; font-weight: bold; text-align: center; background-color: #1e293b; color: #94a3b8; padding: 6px;">RELATÓRIO OFICIAL DE FATURAMENTO E REPASSE</td>
          </tr>
          <tr>
            <td colspan="5" style="font-weight: bold; padding: 10px 0;">Competência Mês: ${competencia}</td>
            <td colspan="7" style="text-align: right; padding: 10px 0;">Emissão do Relatório: ${emissao}</td>
          </tr>
          <tr><td colspan="12" style="padding-bottom: 8px;">Busca: ${searchQuery.trim() || 'Todos os profissionais'}</td></tr>
          <tr><td colspan="12"></td></tr>
          <tr>
            <th>Profissional</th>
            <th>Matrícula</th>
            <th>Especialidade</th>
            <th>Regime Contratual</th>
            <th>Plantões Cumpridos</th>
            <th>Atendimentos Apurados</th>
            <th>Horas Totais</th>
            <th>Valor Bruto (R$)</th>
            <th>Descontos/Taxa (R$)</th>
            <th>Valor Líquido (R$)</th>
            <th>Dados p/ Pagamento</th>
            <th>Status do Repasse</th>
          </tr>
          ${rowsHtml}
          <tr><td colspan="12"></td></tr>
          <tr>
            <td colspan="4" style="font-weight: bold; text-align: right; padding: 8px;">TOTAIS DOS PROFISSIONAIS LISTADOS:</td>
            <td class="num" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${filteredTotals.plantões}</td>
            <td class="num" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${filteredTotals.atendimentos}</td>
            <td class="time" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${formatHourForExcel(filteredTotals.horas)}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${filteredTotals.bruto.toFixed(2).replace('.', ',')}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc; color: #ef4444;">${(filteredTotals.bruto - filteredTotals.liquido).toFixed(2).replace('.', ',')}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc; color: #059669; font-size: 14px;">${filteredTotals.liquido.toFixed(2).replace('.', ',')}</td>
            <td colspan="2"></td>
          </tr>
          ${shiftsAwaitingProduction > 0 ? `<tr><td colspan="12" style="padding: 8px; color: #92400e; font-weight: bold;">Atenção: ${shiftsAwaitingProduction} dia(s) por produtividade aguardam lançamento completo. Os saldos parciais incluem somente diárias já fechadas.</td></tr>` : ''}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Fechamento_Honorarios_${currentUnitName.replace(/[^a-zA-Z0-9]/g, '_')}_${monthPrefix}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintConsolidatedReport = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('Permita os pop-ups para abrir o relatório.');
      return;
    }

    const hospitalName = currentUnitName;
    const logoLetter = hospitalName[0] || 'H';
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR');

    const companyLogoHtml = company?.logo_url ? `<img src="${company.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : `<div class="logo-badge">${logoLetter}</div>`;
    const unitLogoHtml = currentUnitObj?.logo_url ? `<img src="${currentUnitObj.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-left: 15px; border-left: 2px solid #eee; padding-left: 15px;" />` : '';

    const rowsHtml = filteredReport.map((item, idx) => {
      const formaPagto = item.chavePix ? `PIX: ${item.chavePix}` : (item.banco ? `Banco: ${item.banco}` : 'Pendente');
      const statusPago = item.awaitingProduction
        ? `<span style="color: #b45309; font-weight: bold;">Apuração pendente</span>`
        : item.isPago ? `<span style="color: #166534; font-weight: bold;">[ PAGO ]</span>` : `<span style="color: #64748b;">Pendente</span>`;
      const regime = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Produtividade' : 'Por Plantão';

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="border: 1px solid #111; padding: 6px 8px; font-weight: bold;">${item.prof.name}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; font-family: monospace;">${item.matricula}</td>
          <td style="border: 1px solid #111; padding: 6px 8px;">${item.prof.specialty || 'Geral'}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; font-size: 9px;">${regime}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: center;">${item.plantõesRealizados}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: center;">${item.remunType === 'produtividade' ? item.atendimentosApurados : ''}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; font-family: monospace; font-size: 9px;">${formaPagto}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: right;">${formatCurrency(item.valorBruto)}${item.awaitingProduction ? ' (PARCIAL)' : ''}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: right; font-weight: bold;">${formatCurrency(item.valorLiquido)}${item.awaitingProduction ? ' (PARCIAL)' : ''}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: center;">${statusPago}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Fechamento de Honorários - ${competencia}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: #ffffff !important; color: #000 !important; padding: 15px; font-size: 11px; }
          .header-box { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
          .logo-badge { width: 55px; height: 55px; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; margin-right: 15px; }
          .header-info h1 { font-size: 18px; text-transform: uppercase; font-weight: 900; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; font-size: 10px; }
          th { background: #f3f4f6; border: 1px solid #000; padding: 6px 8px; text-transform: uppercase; font-size: 9px; text-align: left; }
          .totals { display: flex; justify-content: flex-end; gap: 30px; font-size: 12px; margin-top: 10px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="display: flex; align-items: center;">
            ${companyLogoHtml}
            ${unitLogoHtml}
            <div class="header-info" style="${unitLogoHtml ? 'margin-left: 15px;' : ''}">
              <h1>${hospitalName}</h1>
              <p>FECHAMENTO DE HONORÁRIOS E REPASSE DE PLANTÕES REALIZADOS</p>
              <div style="margin-top: 4px;">Competência: <b>${competencia}</b></div>
            </div>
          </div>
          <div style="text-align: right; font-size: 9.5px;">
            <div style="border: 1px solid #000; padding: 3px 8px; font-weight: 900; display: inline-block;">DOCUMENTO OFICIAL AUDITÁVEL</div>
            <div style="margin-top: 4px;">Emissão: ${emissao}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Matrícula</th>
              <th>Especialidade</th>
              <th>Regime</th>
              <th style="text-align: center;">Plantões</th>
              <th style="text-align: center;">Atendimentos Apurados</th>
              <th>Dados p/ Pagamento</th>
              <th style="text-align: right;">Bruto Apurado</th>
              <th style="text-align: right;">Líquido a Pagar</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="totals">
          <span>Plantões Cumpridos: ${filteredTotals.plantões}</span>
          <span>Total Bruto: ${formatCurrency(filteredTotals.bruto)}</span>
          <span style="color: #000;">TOTAL LÍQUIDO DOS PROFISSIONAIS LISTADOS: ${formatCurrency(filteredTotals.liquido)}</span>
        </div>
        ${shiftsAwaitingProduction > 0 ? `<p style="margin-top: 8px; color: #92400e; font-weight: bold;">Atenção: ${shiftsAwaitingProduction} dia(s) por produtividade aguardam lançamento completo. O valor exibido para esses profissionais é parcial e inclui somente os dias já fechados.</p>` : ''}

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintIndividualReceipt = (item) => {
    const printWindow = window.open('', '_blank', 'width=900,height=850');
    if (!printWindow) {
      alert('Permita os pop-ups para abrir o recibo.');
      return;
    }

    const hospitalName = currentUnitName;
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = new Date().toLocaleDateString('pt-BR');

    let dadosPagamentoHtml = '';
    if (item.chavePix && item.banco) {
      dadosPagamentoHtml = `
        <div class="grid"><span>Chave PIX (${item.pixTipo}):</span> <span>${item.chavePix}</span></div>
        <div class="grid"><span>Dados Bancários Físicos:</span> <span>${item.banco}</span></div>
      `;
    } else if (item.chavePix) {
      dadosPagamentoHtml = `<div class="grid"><span>Chave PIX (${item.pixTipo}):</span> <span>${item.chavePix}</span></div>`;
    } else if (item.banco) {
      dadosPagamentoHtml = `<div class="grid"><span>Dados Bancários Físicos:</span> <span>${item.banco}</span></div>`;
    } else {
      dadosPagamentoHtml = `<div class="grid"><span style="color: #b91c1c; font-weight: bold;">Forma de Pagamento:</span> <span style="color: #b91c1c;">Pendente de cadastro</span></div>`;
    }

    const isActuallyPaid = item.isPago && !item.awaitingProduction;
    const regimeLabel = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Comissionamento/Produtividade' : 'Plantão Dinâmico';

    const templateVia = (tituloVia) => `
      <div class="via-box">
        <div class="header">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1>${hospitalName}</h1>
              <p>${item.awaitingProduction ? 'APURAÇÃO PENDENTE — NÃO COMPROVA PAGAMENTO' : isActuallyPaid ? 'RECIBO DE HONORÁRIOS & REPASSE MÉDICO' : 'DEMONSTRATIVO DE HONORÁRIOS A PAGAR'}</p>
              <p style="font-size: 9.5px; margin-top: 2px;">Competência: <b>${competencia}</b></p>
            </div>
            <div style="text-align: right;">
              <span class="via-tag">${tituloVia}</span>
              <div style="font-size: 8.5px; color: #555; margin-top: 3px;">Data: ${emissao}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="grid"><span>Profissional:</span> <span>${item.prof.name} (ID: ${item.matricula})</span></div>
          <div class="grid"><span>Documento / Especialidade:</span> <span>${item.prof.document || 'CRM'} • ${item.prof.specialty || 'Geral'}</span></div>
          <div class="grid"><span>Regime de Contratação:</span> <span>${regimeLabel}</span></div>
          <div class="grid"><span>Plantões Cumpridos no Período:</span> <span>${item.plantõesRealizados} plantões (${item.horasRealizadas}h computadas)</span></div>
          ${item.remunType === 'produtividade' ? `<div class="grid"><span>Atendimentos apurados em dias completos:</span> <span>${item.atendimentosApurados}</span></div>` : ''}
          ${item.awaitingProduction ? `<div class="grid"><span>Dias pendentes:</span> <span>${item.plantõesAguardandoProducao} — valores desses dias ainda não incluídos</span></div>` : ''}
        </div>

        <div class="val-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${item.awaitingProduction ? 'Saldo bruto parcial' : 'Valor Bruto'}: <b>${formatCurrency(item.valorBruto)}</b></span>
            <span>Retenção/Taxa: <b>- ${formatCurrency(item.valorDesconto)}</b></span>
            <span style="color: #000; font-size: 13px;">${item.awaitingProduction ? 'SALDO LÍQUIDO PARCIAL' : 'LÍQUIDO A RECEBER'}: <b>${formatCurrency(item.valorLiquido)}</b></span>
          </div>
        </div>

        <div class="section" style="margin-top: 6px;">
          ${dadosPagamentoHtml}
        </div>

        <p class="termo">
          ${isActuallyPaid
            ? `Declaro ter recebido da instituição ${hospitalName} a quantia líquida discriminada acima, correspondente à quitação integral dos serviços profissionais prestados no período de ${competencia}, dando plena e geral quitação.`
            : `Demonstrativo dos valores apurados pelos serviços profissionais prestados no período de ${competencia}. Este documento não comprova pagamento ou quitação.`
          }
        </p>

        <div class="signatures">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span>${hospitalName}</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span>${item.prof.name}</span>
          </div>
        </div>
      </div>
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${isActuallyPaid ? 'Recibo Oficial' : 'Demonstrativo de Honorários'} - ${item.prof.name}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: #ffffff !important; color: #000000 !important; padding: 5px; font-size: 10px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .via-box { border: 1.5px solid #000; padding: 14px 18px; border-radius: 4px; height: 47%; display: flex; flex-direction: column; justify-content: space-between; background: #fff; }
          .header { border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
          .header h1 { font-size: 15px; text-transform: uppercase; font-weight: 900; }
          .header p { font-size: 9px; font-weight: bold; }
          .via-tag { border: 1px solid #000; padding: 2px 6px; font-weight: 900; font-size: 8.5px; text-transform: uppercase; background: #f3f4f6; }
          .section { margin-bottom: 6px; }
          .grid { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 9.5px; }
          .grid span:last-child { font-weight: bold; }
          .val-box { background: #f3f4f6; border: 1px solid #000; padding: 7px 10px; font-size: 11px; margin: 8px 0; }
          .termo { font-size: 8px; color: #333; text-align: justify; margin: 8px 0; line-height: 1.25; }
          .signatures { display: flex; justify-content: space-around; margin-top: 24px; text-align: center; }
          .sig-col { width: 220px; }
          .sig-line { border-top: 1px solid #000; margin-bottom: 3px; }
          .cut-divider { border-top: 1.5px dashed #666; margin: 14px 0; text-align: center; position: relative; height: 12px; }
          .cut-divider span { position: relative; top: -8px; background: #fff; padding: 0 10px; font-size: 8px; color: #666; text-transform: uppercase; font-weight: bold; }
        </style>
      </head>
      <body>
        ${templateVia('1ª VIA - INSTITUIÇÃO')}
        
        <div class="cut-divider">
          <span>✂ CORTE AQUI ✂</span>
        </div>

        ${templateVia('2ª VIA - PROFISSIONAL')}

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSendStatementWhatsApp = (item) => {
    const cleanPhone = String(item.prof.phone || '').replace(/\D/g, '');
    if (!cleanPhone) { alert('Profissional não possui telefone cadastrado.'); return; }
    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const dadosPgto = item.chavePix ? `• Chave PIX: ${item.chavePix} (${item.pixTipo})` : (item.banco ? `• Conta: ${item.banco}` : `• Dados de Pagamento: Pendente`);
    const regimeLabel = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Produtividade' : 'Plantão Dinâmico';

    const msg = [
      `*ScaleMedic - Extrato de Honorários & Repasse* 🏥`,
      `Competência: *${MONTH_NAMES[currentMonth]} / ${currentYear}*`,
      `Profissional: *${item.prof.name}* (ID: ${item.matricula})\n`,
      `📊 *Demonstrativo de Produção:*`,
      `• Regime: ${regimeLabel}`,
      `• Plantões Cumpridos: ${item.plantõesRealizados} plantões (${item.horasRealizadas}h totais)`,
      ...(item.remunType === 'produtividade' ? [`• Atendimentos apurados em dias completos: ${item.atendimentosApurados}`] : []),
      ...(item.awaitingProduction ? [`• Dias pendentes: ${item.plantõesAguardandoProducao} (não incluídos no saldo)`] : []),
      '\n',
      `💰 *Valores Apurados:*`,
      `• ${item.awaitingProduction ? 'Saldo bruto parcial' : 'Valor Bruto Apurado'}: ${formatCurrency(item.valorBruto)}`,
      `• Retenções/Impostos: ${formatCurrency(item.valorDesconto)}`,
      `• *${item.awaitingProduction ? 'SALDO LÍQUIDO PARCIAL' : 'VALOR LÍQUIDO A RECEBER'}:* ${formatCurrency(item.valorLiquido)}\n`,
      `💳 *Forma de Repasse:*`,
      `${dadosPgto}\n`,
      `_Por favor, confira seu demonstrativo. Havendo divergência, contate a coordenação médica._`
    ].filter(Boolean).join('\n');

    window.open(`https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <DollarSign className="w-4 h-4" /> Gestão Financeira & Conciliação de Plantões
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Faturamento & Repasse</h2>
          <p className="text-xs text-slate-300">
            Apuração inteligente baseada na matriz de remuneração (Fixo, Produtividade ou Plantão Dinâmico).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportExcel}
            className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all"
            title="Baixar Relatório em Excel (Abre formatado no Excel)"
          >
            <Download className="w-4 h-4" /> Exportar Planilha (.xls)
          </Button>

          <Button 
            onClick={handlePrintConsolidatedReport}
            className="h-10 bg-white text-slate-900 hover:bg-slate-100 font-black text-xs px-4 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" /> Imprimir Fechamento
          </Button>

          <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl gap-2">
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black px-2 uppercase cursor-default">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CARDS EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400">Total Bruto Apurado</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(totals.bruto)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{totals.plantões} plantões concluídos · inclui fixo mensal</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Total Líquido p/ Repasse</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totals.liquido)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Valor acumulado na competência</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400">Horas de plantões concluídos</span>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{totals.horas.toFixed(1).replace('.', ',')}h</div>
          <span className="text-[10px] text-slate-500 font-semibold">Horas assistenciais efetivadas</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Profissionais na competência</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{reportData.length}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Com plantões ou regime mensal</span>
        </Card>
      </div>

      {(isManager || isProductivityPoolUnit) && (
        <Card className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-500/30 dark:bg-indigo-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-indigo-950 dark:text-indigo-200">Produtividade diária por unidade</h2>
              <p className="mt-1 text-xs text-indigo-900/80 dark:text-indigo-200/80">
                Uma única unidade pode usar o rateio diário de R$ 150. Só entram profissionais cadastrados com regime de produtividade. O valor unitário é o pool dividido pelos atendimentos do dia; cada profissional recebe sua parte proporcional.
              </p>
            </div>
            {isProductivityPoolUnit && isManager && (
              <Button type="button" onClick={() => setProductionEntryOpen(true)} className="shrink-0 bg-indigo-600 text-white hover:bg-indigo-700">
                Lançar atendimentos do dia
              </Button>
            )}
          </div>
          {isManager && (
            <div className="flex flex-col gap-2 border-t border-indigo-200 pt-3 dark:border-indigo-500/20 sm:flex-row sm:items-end">
              <label className="flex-1 space-y-1 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Unidade exclusiva para esta regra
                <select
                  value={productivityUnitDraft}
                  onChange={event => setProductivityUnitDraft(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold normal-case text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Não configurar</option>
                  {units.map(unit => <option key={unit.id} value={String(unit.id)}>{unit.name}</option>)}
                </select>
              </label>
              <Button type="button" disabled={productivityConfigSaving} onClick={handleSaveProductivityConfiguration} className="h-10 bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-500">
                {productivityConfigSaving ? 'Salvando...' : productivityUnitDraft ? 'Salvar unidade da regra' : 'Desativar regra'}
              </Button>
            </div>
          )}
          {productivityRuleUnitId && (
            <div className="rounded-xl border border-indigo-200 bg-white/80 p-3 text-xs text-indigo-950 dark:border-indigo-500/20 dark:bg-slate-900/80 dark:text-indigo-100">
              Unidade configurada: <strong>{units.find(unit => String(unit.id) === productivityRuleUnitId)?.name || 'Unidade não encontrada'}</strong> · Limite diário compartilhado: <strong>{formatCurrency(safeNumber(productivityRule.daily_amount, 150))}</strong>.
              {isProductivityPoolUnit && <span> Cada dia é apurado separadamente; só os profissionais cadastrados como produtividade entram no rateio. Dias completos já entram no saldo acumulado, mesmo que outro dia ainda esteja pendente.</span>}
            </div>
          )}
        </Card>
      )}

      {(shiftsWithoutRate > 0 || shiftsAwaitingProduction > 0 || shiftsWithoutProfessional > 0 || shiftsWithInvalidSchedule > 0 || professionalsWithoutMonthlySalary > 0) && (
        <Card className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-300">Verifique os dados antes de fechar o repasse</h3>
              {shiftsWithoutRate > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {shiftsWithoutRate} plantão(ões) realizado(s) sem tarifa cadastrada na unidade. Esses valores aparecem como R$ 0,00 e deixam o total bruto incompleto.
                </p>
              )}
              {shiftsAwaitingProduction > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {shiftsAwaitingProduction} dia(s) de produtividade aguardam apuração completa. {!isProductivityPoolUnit
                    ? 'A regra do pool diário ainda não está configurada para esta unidade.'
                    : 'A apuração fica pendente até o gestor registrar os atendimentos de todos os profissionais escalados no dia.'}
                  {' '}O pagamento não pode ser marcado até os dados estarem completos.
                </p>
              )}
              {professionalsWithoutMonthlySalary > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {professionalsWithoutMonthlySalary} profissional(is) em regime mensal não têm valor cadastrado para esta unidade. O valor não foi atribuído ao fechamento.
                </p>
              )}
              {shiftsWithoutProfessional > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {shiftsWithoutProfessional} plantão(ões) da competência apontam para um profissional que não foi localizado no Corpo Clínico e não entraram na conciliação.
                </p>
              )}
              {shiftsWithInvalidSchedule > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {shiftsWithInvalidSchedule} plantão(ões) têm data ou horário inválido e foram excluídos da apuração de horas.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Marcado como pago</p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">{paymentSummary.paid.count} profissional(is)</p>
          </div>
          <strong className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(paymentSummary.paid.net)}</strong>
        </Card>
        <Card className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">Pendente de pagamento</p>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">{paymentSummary.pending.count} profissional(is)</p>
          </div>
          <strong className="text-lg font-black text-amber-700 dark:text-amber-300">{formatCurrency(paymentSummary.pending.net)}</strong>
        </Card>
        <Card className="flex items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-950/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-400">Aguardando apuração</p>
            <p className="mt-1 text-xs text-indigo-800/80 dark:text-indigo-300/80">{paymentSummary.awaiting.count} profissional(is)</p>
          </div>
          <strong className="text-sm font-black text-indigo-700 dark:text-indigo-300">Produção</strong>
        </Card>
      </div>
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
        O status de pagamento é salvo neste navegador e ainda não sincroniza entre usuários ou dispositivos.
      </p>

      {/* TABELA DE CONCILIAÇÃO FINANCEIRA COM STATUS DE PAGAMENTO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Espelho de Conciliação Financeira</h3>
            <p className="text-xs text-slate-500">Apuração restrita para <b>{currentUnitName}</b>. O status de pagamento é salvo neste navegador.</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por médico ou matrícula..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 h-9 text-xs" 
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Profissional / Matrícula</th>
                <th className="py-3 px-4">Regime Contratual</th>
                <th className="py-3 px-4 text-center">Volume Apurado</th>
                <th className="py-3 px-4">Dados p/ Repasse</th>
                <th className="py-3 px-4 text-right">Líquido a Pagar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredReport.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Nenhum profissional com produção na unidade atual para esta competência.
                  </td>
                </tr>
              ) : (
                filteredReport.map(item => {
                  const formaPagto = item.chavePix ? (
                    <div><span className="text-sky-600 font-bold">{item.chavePix}</span><div className="text-[9px] text-slate-400">PIX ({item.pixTipo})</div></div>
                  ) : item.banco ? (
                    <div><span className="text-slate-800 dark:text-slate-200 font-bold">{item.banco}</span><div className="text-[9px] text-slate-400">Dados Bancários</div></div>
                  ) : (
                    <span className="text-[10px] text-rose-500 italic">Pendente de cadastro</span>
                  );

                  const regimeBadge = item.remunType === 'mensal' 
                    ? <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px]">Fixo Mensal</span> 
                    : item.remunType === 'produtividade'
                    ? <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold text-[10px]">Produtividade</span>
                    : <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-bold text-[10px]">Por Plantão</span>;

                  return (
                    <tr key={item.prof.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 dark:text-white">{item.prof.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
                          <span className="text-indigo-600 dark:text-indigo-400">{item.matricula} • {item.prof.document || 'CRM'}</span>
                          {item.profStatus && item.profStatus !== 'ativo' && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-sans text-[9px] uppercase text-slate-500 dark:bg-slate-800">{item.profStatus} · com registro</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {regimeBadge}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900 dark:text-white">{item.plantõesRealizados} plantões</span>
                        <div className="text-[10px] font-mono text-slate-400">{item.horasRealizadas.toFixed(1).replace('.', ',')}h totais</div>
                        {item.remunType === 'produtividade' && (
                          <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {item.atendimentosApurados} atendimento(s) em dias fechados
                          </div>
                        )}
                        {item.plantõesAguardandoProducao > 0 && (
                          <div className="mt-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">{item.plantõesAguardandoProducao} dia(s) pendente(s)</div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {formaPagto}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.valorLiquido)}
                        </span>
                        {item.awaitingProduction && (
                          <div className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                            Saldo parcial · {item.plantõesAguardandoProducao} dia(s) pendente(s)
                          </div>
                        )}
                        {item.taxRate > 0 && <div className="text-[9px] text-rose-500">-{item.taxRate}% retenção</div>}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleTogglePago(item.prof.id)}
                          disabled={item.awaitingProduction && !item.isPago}
                          title={item.awaitingProduction ? item.isPago ? 'O pagamento já marcado deve ser revisado após a apuração.' : 'Aguarde o lançamento da produção para conciliar o pagamento.' : undefined}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all border disabled:cursor-not-allowed disabled:opacity-60 ${
                            item.isPago 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' 
                              : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {item.awaitingProduction ? item.isPago ? 'Pago · revisar' : 'Apuração pendente' : item.isPago ? '✓ Pago' : 'Pendente'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handlePrintIndividualReceipt(item)}
                            title={item.awaitingProduction ? 'Imprimir demonstrativo; apuração pendente e sem comprovação de pagamento' : item.isPago ? 'Imprimir recibo em 2 vias' : 'Imprimir demonstrativo; não comprova pagamento'}
                            className="h-8 text-xs font-bold gap-1 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-white cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" /> {item.isPago && !item.awaitingProduction ? 'Recibo' : 'Demonstrativo'}
                          </Button>

                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setSelectedProfModal(item)}
                            className="h-8 text-xs font-bold gap-1 rounded-xl cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-sky-600" /> Detalhar
                          </Button>

                          {item.prof.phone && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleSendStatementWhatsApp(item)}
                              title="Enviar Extrato no WhatsApp"
                              className="h-8 px-2.5 rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={productionEntryOpen} onOpenChange={setProductionEntryOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-indigo-700 dark:text-indigo-300">
              Lançamento diário de atendimentos
            </DialogTitle>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Informe a quantidade de cada profissional escalado e cadastrado como produtividade. O rateio diário só fecha quando todos os elegíveis tiverem um número informado, inclusive zero.
            </p>
          </DialogHeader>
          <label className="space-y-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            Data da produção
            <Input type="date" value={productionDate} onChange={event => setProductionDate(event.target.value)} className="h-10 text-sm" />
          </label>
          <input
            ref={productivityFileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImportProductivityWorkbook}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={productionEntryRows.length === 0 || productionImporting} onClick={handleDownloadProductivityTemplate} className="h-9 text-xs font-bold">
              Baixar modelo Excel
            </Button>
            <Button type="button" variant="outline" disabled={productionEntryRows.length === 0 || productionImporting} onClick={() => productivityFileInputRef.current?.click()} className="h-9 text-xs font-bold">
              {productionImporting ? 'Importando...' : 'Importar Excel'}
            </Button>
          </div>
          <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
            {productionEntryRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-slate-700">
                Não há profissionais com plantão por produtividade nessa unidade e data.
              </p>
            ) : productionEntryRows.map(({ professional, shiftCount }) => (
              <div key={professional.id} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black">{professional.name}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{professional.specialty || 'Especialidade não informada'} · {shiftCount} plantão(ões)</p>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={productionDraft[String(professional.id)] ?? ''}
                  onChange={event => setProductionDraft(previous => ({
                    ...previous,
                    [String(professional.id)]: event.target.value
                  }))}
                  aria-label={`Quantidade de atendimentos de ${professional.name}`}
                  placeholder="Atendimentos"
                  className="h-10 text-right font-mono"
                />
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-950 dark:bg-indigo-500/10 dark:text-indigo-100">
            Total informado: <strong>{Object.values(productionDraft).reduce((total, value) => total + (/^\d+$/.test(String(value)) ? Number(value) : 0), 0)}</strong> atendimento(s) · Pool diário: <strong>{formatCurrency(safeNumber(productivityRule?.daily_amount, 150))}</strong>
            {' '}· Valor por atendimento: <strong>{(() => {
              const count = Object.values(productionDraft).reduce((total, value) => total + (/^\d+$/.test(String(value)) ? Number(value) : 0), 0);
              return count > 0
                ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(safeNumber(productivityRule?.daily_amount, 150) / count)
                : 'aguardando total maior que zero';
            })()}</strong>
          </div>
          {productionError && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{productionError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setProductionEntryOpen(false)} disabled={productionSaving}>Cancelar</Button>
            <Button type="button" onClick={handleSaveDailyProduction} disabled={productionSaving || productionEntryRows.length === 0} className="bg-indigo-600 font-bold text-white hover:bg-indigo-700">
              {productionSaving ? 'Salvando...' : 'Salvar atendimentos'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE DETALHAMENTO */}
      <Dialog open={!!selectedProfModal} onOpenChange={() => setSelectedProfModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Espelho de Produção • {selectedProfModal?.prof.name}
            </DialogTitle>
          </DialogHeader>

          {selectedProfModal && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Matrícula ID</span>
                  <strong className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{selectedProfModal.matricula}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Regime Contratual</span>
                  <strong className="text-xs text-slate-900 dark:text-white block uppercase">
                    {selectedProfModal.remunType === 'mensal' ? 'Fixo Mensal' : selectedProfModal.remunType === 'produtividade' ? 'Produtividade' : 'Plantão Dinâmico'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Plantões Realizados</span>
                  <strong className="text-sm">{selectedProfModal.plantõesRealizados} plantões</strong>
                </div>
                {selectedProfModal.remunType === 'produtividade' && (
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Atendimentos Apurados</span>
                    <strong className="text-sm">{selectedProfModal.atendimentosApurados}</strong>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Líquido Apurado</span>
                  <strong className="text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedProfModal.valorLiquido)}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-black uppercase text-slate-500 text-[11px] block">Extrato de Plantões (Realizados vs Programados)</span>
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedProfModal.plantõesList.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Nenhum plantão localizado na grade deste mês.</div>
                  ) : (
                    selectedProfModal.plantõesList.map(p => (
                      <div key={p.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/50 gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${p.isRealizado ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                              {p.isRealizado ? 'Realizado' : 'A Realizar'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">{sectorMap[p.sector_id]?.name || 'Setor'} • {p.start_time} às {p.end_time}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          {selectedProfModal.remunType === 'plantao' && p.isRealizado && (
                            <span className={`text-[10px] font-bold ${p.tarifaPendente ? 'text-amber-600' : 'text-slate-500'}`}>
                              {p.tarifaPendente ? 'Tarifa não cadastrada' : p.aguardandoProducao ? 'Aguardando lançamento da produção' : `Apurado: ${formatCurrency(p.valorAplicado)}`}
                            </span>
                          )}
                          {['produtividade', 'production'].includes(selectedProfModal.remunType) && p.isRealizado && (
                            <span className={`text-[10px] font-bold ${p.aguardandoProducao ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                              Atendimentos: {p.atendimentoDia ?? 'não lançado'} · {p.aguardandoProducao ? 'Aguardando apuração diária' : `Rateio: ${formatCurrency(p.valorAplicado)}`}
                            </span>
                          )}
                          <span className="font-mono font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/30 px-2 py-1 rounded-lg">
                            {p.duration}h
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handlePrintIndividualReceipt(selectedProfModal)}
                  className="h-9 text-xs font-black gap-1.5 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" /> {selectedProfModal.isPago ? 'Imprimir recibo' : 'Imprimir demonstrativo'}
                </Button>
                
                <Button onClick={() => handleSendStatementWhatsApp(selectedProfModal)} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 gap-2 cursor-pointer">
                  <Send className="w-3.5 h-3.5" /> Enviar WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}