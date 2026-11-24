import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useAppData } from '@/lib/useAppData';
import { getMonthlySalaryForUnit, getShiftCostEstimate } from '@/lib/financialCalculations';
import { calculateProductivityPoolAllocations, isProductivityDayComplete } from '@/lib/productivityCalculations';
import { getProfessionalUnitIds } from '@/lib/sectorAccess';
import { computeReliability } from '@/lib/reliability';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/PageHero';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer as PrinterIcon, FileSpreadsheet, RotateCcw, Search } from 'lucide-react';
import { safeNumber, formatCurrency, formatDate, normalize, countLabel, titleCase, getShiftName, getSectorName, isVacant, roundHours, isShiftPast, getShiftHours, getProfessionalMeta, getStoredProductivityAttendance, isMonthlyType, isProductivityType, getRemunerationType, monthDaysInPeriod, monthsInPeriod, getLocalDateInputValue, REPORT_NAVIGATION, REPORT_GROUPS, REPORTS_WITH_STATUS_FILTER, PERIODS, periodRange } from '@/lib/reportUtils';
import { exportReportExcel, printReport } from '@/lib/reportExport';
import OverviewReport from '@/components/reports/OverviewReport';
import ScheduleReports from '@/components/reports/ScheduleReports';
import RegistryReports from '@/components/reports/RegistryReports';
import ProductivityReports from '@/components/reports/ProductivityReports';
import ReliabilityReport from '@/components/reports/ReliabilityReport';
import FinancialReport from '@/components/reports/FinancialReport';

export default function Relatorios() {
  const {
    shifts: unitShifts = [], sectors: unitSectors = [], professionals: unitProfessionals = [],
    allCompanyShifts = [], allCompanySectors = [], allCompanyProfessionals = [],
    allUnitsView, user, company, units = [], selectedUnitId, isManager, allCompanySwaps = []
  } = useAppData();
  // Algumas abas (ex.: Confiabilidade) são só da gestão.
  const reportNavigation = REPORT_NAVIGATION.filter(report => !report.managerOnly || isManager);
  // "Todas as unidades" (escolha global do topo) junta as unidades que o gestor administra.
  const managedUnitIds = useMemo(() => {
    const allowed = Array.isArray(user?.data?.allowed_unit_ids) ? user.data.allowed_unit_ids.map(String) : [];
    return (units || []).filter(u => user?.role === 'admin' || allowed.length === 0 || allowed.includes(String(u.id))).map(u => String(u.id));
  }, [units, user]);
  const isAllUnits = Boolean(allUnitsView) && managedUnitIds.length > 1;
  const scopeUnitIds = useMemo(() => (isAllUnits ? managedUnitIds : [String(selectedUnitId)]), [isAllUnits, managedUnitIds, selectedUnitId]);
  const shifts = useMemo(() => (isAllUnits ? allCompanyShifts.filter(s => scopeUnitIds.includes(String(s.unit_id))) : unitShifts), [isAllUnits, allCompanyShifts, scopeUnitIds, unitShifts]);
  const sectors = useMemo(() => (isAllUnits ? allCompanySectors.filter(s => scopeUnitIds.includes(String(s.unit_id))) : unitSectors), [isAllUnits, allCompanySectors, scopeUnitIds, unitSectors]);
  const professionals = useMemo(() => (isAllUnits
    ? allCompanyProfessionals.filter(p => getProfessionalUnitIds(p).some(id => scopeUnitIds.includes(id)))
    : unitProfessionals), [isAllUnits, allCompanyProfessionals, scopeUnitIds, unitProfessionals]);
  const unitNameById = useMemo(() => Object.fromEntries((units || []).map(u => [String(u.id), u.name])), [units]);

  const [activeTab, setActiveTab] = useState('bi');
  
  const today = new Date();
  const firstDay = getLocalDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = getLocalDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const currentYear = today.getFullYear();

  const [dateStart, setDateStart] = useState(firstDay);
  const [dateEnd, setDateEnd] = useState(lastDay);
  const [selectedSector, setSelectedSector] = useState('todos');
  const [profStatusFilter, setProfStatusFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductivityProfessionalId, setSelectedProductivityProfessionalId] = useState('');

  // Os filtros valem na hora: o relatório muda enquanto a pessoa escolhe.
  const [period, setPeriod] = useState('mes');
  const [shiftRowsLimit, setShiftRowsLimit] = useState(50);
  const hasSearched = true;
  const deferredSearch = useDeferredValue(searchQuery);
  const appliedFilters = useMemo(() => ({
    start: dateStart,
    end: dateEnd && dateStart && dateEnd < dateStart ? dateStart : dateEnd,
    sector: selectedSector,
    profStatus: profStatusFilter,
    search: deferredSearch
  }), [dateStart, dateEnd, selectedSector, profStatusFilter, deferredSearch]);

  const choosePeriod = (id) => {
    setPeriod(id);
    if (id === 'personalizado') return;
    const [start, end] = periodRange(id);
    setDateStart(start);
    setDateEnd(end);
  };

  const handleClearFilters = () => {
    setPeriod('mes');
    setDateStart(firstDay);
    setDateEnd(lastDay);
    setSelectedSector('todos');
    setProfStatusFilter('todos');
    setSearchQuery('');
  };
  const filtersChanged = period !== 'mes' || selectedSector !== 'todos' || profStatusFilter !== 'todos' || searchQuery !== '';

  const profMap = useMemo(() => {
    const map = {};
    professionals.forEach(p => {
      const meta = getProfessionalMeta(p);
      const merged = { ...p, ...meta };
      if (p.id) map[String(p.id)] = merged;
      if (p.name) map[normalize(p.name)] = merged;
    });
    return map;
  }, [professionals]);

  const getProf = useCallback(shift => {
    return profMap[String(shift.professional_id)] || profMap[normalize(getShiftName(shift))];
  }, [profMap]);

  const filteredShifts = useMemo(() => {
    if (!hasSearched) return [];
    const term = normalize(appliedFilters.search);

    const filtered = shifts.filter(shift => {
      if (!shift || normalize(shift.status) === 'cancelado') return false;
      const rawSecName = getSectorName(shift, sectors);
      const secName = normalize(rawSecName);
      if (!secName || secName === 'setor' || secName.includes('setor geral')) return false;
      if (appliedFilters.sector !== 'todos' && String(shift.sector_id) !== String(appliedFilters.sector)) return false;

      const shiftDate = String(shift.date || shift.start_date || shift.data || '').slice(0, 10);
      if (shiftDate) {
        if (appliedFilters.start && shiftDate < appliedFilters.start) return false;
        if (appliedFilters.end && shiftDate > appliedFilters.end) return false;
      }

      if (term) {
        const profName = normalize(getShiftName(shift));
        if (!profName.includes(term) && !secName.includes(term)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [shifts, sectors, appliedFilters, hasSearched]);

  const productivityReport = useMemo(() => {
    const rule = company?.data?.productivity_pool_rule;
    const ruleUnitId = rule?.unit_id ? String(rule.unit_id) : '';
    const configuredPool = safeNumber(rule?.daily_amount, 150);
    const dailyPool = Math.round(configuredPool * 100) / 100;
    if (!hasSearched || !ruleUnitId || !scopeUnitIds.includes(ruleUnitId)) {
      return { configured: Boolean(ruleUnitId), available: false, ruleUnitId, dailyPool, days: [], rows: [], professionalTotals: [], totals: { attendance: 0, pool: 0, shifts: 0, professionals: 0, pendingDays: 0 } };
    }
    if (configuredPool < 0 || !Number.isSafeInteger(Math.round(configuredPool * 100))) {
      return { configured: true, available: false, error: 'O valor diário configurado não é um valor monetário válido.', ruleUnitId, dailyPool, days: [], rows: [], professionalTotals: [], totals: { attendance: 0, pool: 0, shifts: 0, professionals: 0, pendingDays: 0 } };
    }

    const now = new Date();
    const eligibleProfessionals = new Map();
    professionals.forEach(professional => {
      if (!professional?.id) return;
      const meta = getProfessionalMeta(professional);
      const remunerationType = normalize(meta.remuneration_type || meta.remunerationType || meta.payment_type);
      if (remunerationType !== 'produtividade' && remunerationType !== 'production') return;
      eligibleProfessionals.set(String(professional.id), { ...professional, ...meta });
    });

    const byDate = new Map();
    shifts.forEach(shift => {
      const shiftStatus = normalize(shift?.status);
      if (!shift || String(shift.unit_id) !== ruleUnitId ||
        shiftStatus.includes('cancel') || ['vago', 'vaga'].includes(shiftStatus)) return;
      const date = String(shift.date || '').slice(0, 10);
      if (!date || (appliedFilters.start && date < appliedFilters.start) || (appliedFilters.end && date > appliedFilters.end)) return;
      const professionalId = String(shift.professional_id || '');
      const professional = eligibleProfessionals.get(professionalId);
      if (!professional || shift.is_open === true) return;
      const name = normalize(getShiftName(shift) || professional.name);
      if (['vaga', 'aberto', 'descoberto', 'sem profissional', 'plantao sem profissional'].some(marker => name.includes(marker))) return;
      const sector = sectors.find(item => String(item.id) === String(shift.sector_id));
      const sectorName = sector?.name || shift.sector_name || 'Setor não informado';
      const dayRows = byDate.get(date) || new Map();
      const row = dayRows.get(professionalId) || {
        date,
        professional,
        professionalId,
        attendanceCount: getStoredProductivityAttendance(professional, ruleUnitId, date),
        shifts: 0,
        sectorIds: new Set(),
        sectorNames: new Set(),
        allShiftsCompleted: true
      };
      row.shifts += 1;
      row.sectorIds.add(String(shift.sector_id || ''));
      row.sectorNames.add(sectorName);
      const start = `${date}T${String(shift.start_time || '07:00').slice(0, 5)}:00`;
      const end = `${date}T${String(shift.end_time || '19:00').slice(0, 5)}:00`;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
      const status = normalize(shift.status);
      if (!['realizado', 'concluido', 'concluida'].includes(status) && (Number.isNaN(endDate.getTime()) || endDate > now)) {
        row.allShiftsCompleted = false;
      }
      dayRows.set(professionalId, row);
      byDate.set(date, dayRows);
    });

    const dailyGroups = [...byDate.entries()].sort(([dateA], [dateB]) => dateA.localeCompare(dateB)).map(([date, dayRows]) => {
      const items = [...dayRows.values()];
      const missingCount = items.filter(item => item.attendanceCount === null).length;
      const unfinishedShift = items.some(item => !item.allShiftsCompleted);
      const attendanceTotal = items.reduce((sum, item) => sum + (item.attendanceCount ?? 0), 0);
      const complete = isProductivityDayComplete(items.map(item => ({
        attendance_count: item.attendanceCount,
        shift_completed: item.allShiftsCompleted
      })));
      return {
        date,
        complete,
        missingCount,
        unfinishedShift,
        items,
        totalAttendance: complete ? attendanceTotal : null,
        invalidTotal: missingCount === 0 && !Number.isSafeInteger(attendanceTotal),
        poolAmount: complete ? dailyPool : null
      };
    });

    const allocationRows = dailyGroups.flatMap(day => day.items.map(item => ({
      id: `${day.date}:${item.professionalId}`,
      date: day.date,
      professional_id: item.professionalId,
      attendance_count: day.complete ? item.attendanceCount : null
    })));
    const allocations = calculateProductivityPoolAllocations(allocationRows, dailyPool);
    const rows = dailyGroups.flatMap(day => day.items.map(item => {
      const matchesSector = appliedFilters.sector === 'todos' || item.sectorIds.has(String(appliedFilters.sector));
      const status = normalize(item.professional.status || item.professional.data?.status || 'ativo');
      const matchesStatus = appliedFilters.profStatus === 'todos' || status === appliedFilters.profStatus;
      const term = normalize(appliedFilters.search);
      const matchesSearch = !term || normalize(item.professional.name).includes(term) ||
        normalize(item.professional.specialty).includes(term) ||
        [...item.sectorNames].some(sectorName => normalize(sectorName).includes(term));
      if (!matchesSector || !matchesStatus || !matchesSearch) return null;
      const key = `${day.date}:${item.professionalId}`;
      const rate = day.complete && day.totalAttendance > 0 ? dailyPool / day.totalAttendance : null;
      return {
        date: day.date,
        professional: item.professional,
        sectors: [...item.sectorNames].join(', '),
        shifts: item.shifts,
        attendance: item.attendanceCount,
        unitRate: rate,
        amount: day.complete ? allocations.allocationsByDateAndProfessional.get(key) || 0 : null,
        complete: day.complete,
        pendingReason: !day.complete
          ? day.missingCount > 0
            ? `${day.missingCount} contagem(ns) pendente(s)`
            : day.unfinishedShift
              ? 'Plantão ainda em andamento'
              : 'Total de atendimentos inválido'
          : day.totalAttendance === 0 ? 'Sem atendimentos no dia' : ''
      };
    }).filter(Boolean));

    const professionalTotalsById = new Map();
    rows.forEach(row => {
      const key = String(row.professional.id);
      const summary = professionalTotalsById.get(key) || {
        professional: row.professional,
        shifts: 0,
        attendance: 0,
        amount: 0,
        pendingDays: 0,
        dates: new Set()
      };
      summary.shifts += row.shifts;
      summary.dates.add(row.date);
      if (row.complete) {
        summary.attendance += row.attendance || 0;
        summary.amount += row.amount || 0;
      } else {
        summary.pendingDays += 1;
      }
      professionalTotalsById.set(key, summary);
    });
    const professionalTotals = [...professionalTotalsById.values()]
      .map(item => ({ ...item, dates: item.dates.size }))
      .sort((a, b) => a.professional.name.localeCompare(b.professional.name));

    const totals = dailyGroups.reduce((summary, day) => {
      summary.shifts += day.items.reduce((sum, item) => sum + item.shifts, 0);
      if (day.complete) {
        summary.attendance += day.totalAttendance;
        summary.pool += day.totalAttendance > 0 ? day.poolAmount : 0;
      } else {
        summary.pendingDays += 1;
      }
      return summary;
    }, { attendance: 0, pool: 0, shifts: 0, professionals: eligibleProfessionals.size, pendingDays: 0 });

    const shiftCountByKey = new Map();
    dailyGroups.forEach(day => day.items.forEach(item => shiftCountByKey.set(`${day.date}:${item.professionalId}`, item.shifts)));
    const completeDates = new Set(dailyGroups.filter(day => day.complete).map(day => day.date));
    return {
      configured: true, available: true, ruleUnitId, dailyPool, days: dailyGroups, rows, professionalTotals, totals,
      allocationByKey: allocations.allocationsByDateAndProfessional, shiftCountByKey, completeDates
    };
  }, [company, scopeUnitIds, professionals, shifts, sectors, appliedFilters, hasSearched]);

  const swapsList = useMemo(() => {
    if (!hasSearched) return [];
    return filteredShifts.filter(s => s.notes && /\[SOLICITADO_POR:/i.test(s.notes)).map(s => {
      const reqMatch = s.notes.match(/\[SOLICITADO_POR:\s*([^\]]+)\]/i);
      const requester = reqMatch ? reqMatch[1] : 'Desconhecido';
      const isPending = s.status === 'aguardando_aprovacao_gestor' || s.notes.includes('[AGUARDANDO_GESTOR]');
      
      let currentProf = titleCase(getShiftName(s));
      if (!currentProf || isVacant(s)) {
        currentProf = 'Mural (Aberto)';
      }

      return {
        ...s,
        requester: titleCase(requester),
        currentProf,
        isPending,
        swapStatus: isPending ? 'Aguardando Gestão' : 'Repasse Concluído'
      };
    });
  }, [filteredShifts, hasSearched]);

  const filteredProfessionals = useMemo(() => {
    if (!hasSearched) return [];
    const term = normalize(appliedFilters.search);
    
    return professionals.filter(p => {
      const status = normalize(p.status || 'ativo');
      if (appliedFilters.profStatus === 'ativo' && status !== 'ativo') return false;
      if (appliedFilters.profStatus === 'inativo' && status !== 'inativo') return false;
      
      const meta = getProfessionalMeta(p);
      const name = normalize(p.name);
      const spec = normalize(meta.specialty || '');
      
      if (term && !name.includes(term) && !spec.includes(term)) return false;
      return true;
    }).map(p => {
      const meta = getProfessionalMeta(p);
      return {
        ...p,
        ...meta,
        specialty: titleCase(meta.specialty || meta.main_sector || 'Clínico Geral')
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [professionals, appliedFilters, hasSearched]);

  const birthDaysList = useMemo(() => {
    if (!hasSearched || !appliedFilters.start || !appliedFilters.end) return [];
    
    const startObj = new Date(appliedFilters.start + 'T12:00:00');
    const filterMonthStart = startObj.getMonth() + 1;
    const targetMonthStr = String(filterMonthStart).padStart(2, '0');

    return filteredProfessionals.filter(p => {
      const bDate = p.birth_date || p.birthDate || p.data_nascimento;
      if (!bDate) return false;
      
      const parts = bDate.split('-');
      if (parts.length !== 3) return false;
      const bMonth = parts[1];
      
      return bMonth === targetMonthStr;
    }).map(p => {
      const parts = (p.birth_date || p.birthDate || p.data_nascimento).split('-');
      const day = parseInt(parts[2], 10);
      const bYear = parseInt(parts[0], 10);
      const currentAge = currentYear - bYear;
      
      return {
        ...p,
        birthDayNum: day,
        birthDateFormatted: `${parts[2]}/${parts[1]}`,
        ageTurns: currentAge
      };
    }).sort((a, b) => a.birthDayNum - b.birthDayNum); 
  }, [filteredProfessionals, appliedFilters, currentYear, hasSearched]);

  const { totalShiftsCount, filledShiftsCount, vacantShiftItems } = useMemo(() => {
    let filled = 0;
    let vacantItems = [];
    filteredShifts.forEach(s => {
      if (!isVacant(s)) filled++;
      else vacantItems.push(s);
    });
    return { 
      totalShiftsCount: filteredShifts.length, 
      filledShiftsCount: filled, 
      vacantShiftsCount: filteredShifts.length - filled, 
      vacantShiftItems: vacantItems 
    };
  }, [filteredShifts]);

  const coverageRate = totalShiftsCount > 0 ? Math.round((filledShiftsCount / totalShiftsCount) * 100) : 100;

  // Custo de cada plantão no período, com a MESMA base do Faturamento:
  // - mensalista: salário da unidade proporcional aos dias do período, dividido
  //   entre os plantões dele (o mês inteiro soma exatamente o salário);
  // - produtividade: valor rateado dos dias já fechados;
  // - plantão / hora / diária: tarifa cadastrada.
  const costModel = useMemo(() => {
    const byShift = new Map();
    const missingRate = new Set();
    const pendingProduction = new Set();
    const monthlyGroups = new Map();

    filteredShifts.forEach(shift => {
      const id = String(shift.id);
      byShift.set(id, 0);
      if (isVacant(shift)) return;
      const professional = getProf(shift);
      if (!professional) { missingRate.add(id); return; }
      const type = getRemunerationType(professional);
      const date = String(shift.date || '').slice(0, 10);

      if (isMonthlyType(type)) {
        const key = `${professional.id}|${shift.unit_id}|${date.slice(0, 7)}`;
        const group = monthlyGroups.get(key) || { professional, unitId: shift.unit_id, month: date.slice(0, 7), ids: [] };
        group.ids.push(id);
        monthlyGroups.set(key, group);
        return;
      }

      if (isProductivityType(type)) {
        const key = `${date}:${professional.id}`;
        if (productivityReport.completeDates?.has(date)) {
          byShift.set(id, (productivityReport.allocationByKey?.get(key) || 0) / (productivityReport.shiftCountByKey?.get(key) || 1));
        } else {
          pendingProduction.add(id);
        }
        return;
      }

      const estimate = getShiftCostEstimate(professional, { ...shift, duration_hours: getShiftHours(shift) });
      byShift.set(id, estimate.amount);
      if (estimate.missingRate) missingRate.add(id);
    });

    monthlyGroups.forEach(group => {
      const salary = getMonthlySalaryForUnit(group.professional, group.unitId);
      if (salary.missing) { group.ids.forEach(id => missingRate.add(id)); return; }
      const { days, daysInMonth } = monthDaysInPeriod(group.month, appliedFilters.start, appliedFilters.end);
      const perShift = (salary.value * (days / daysInMonth)) / group.ids.length;
      group.ids.forEach(id => byShift.set(id, perShift));
    });

    // Mensalistas ativos da unidade sem plantão no período: a folha deles existe
    // (o Faturamento a inclui), mas não pertence a nenhuma escala.
    let payrollWithoutShifts = 0;
    let professionalsWithoutShifts = 0;
    const months = monthsInPeriod(appliedFilters.start, appliedFilters.end);
    if (hasSearched && appliedFilters.sector === 'todos') {
      professionals.forEach(professional => {
        if (!isMonthlyType(getRemunerationType(professional))) return;
        if (normalize(professional.status || professional.data?.status || 'ativo') !== 'ativo') return;
        let counted = false;
        const professionalUnits = getProfessionalUnitIds(professional);
        scopeUnitIds
          .filter(unitId => !isAllUnits || professionalUnits.length === 0 || professionalUnits.includes(unitId))
          .forEach(unitId => {
            months.forEach(month => {
              if (monthlyGroups.has(`${professional.id}|${unitId}|${month}`)) return;
              const salary = getMonthlySalaryForUnit(professional, unitId);
              if (salary.missing) return;
              const { days, daysInMonth } = monthDaysInPeriod(month, appliedFilters.start, appliedFilters.end);
              payrollWithoutShifts += salary.value * (days / daysInMonth);
              counted = true;
            });
          });
        if (counted) professionalsWithoutShifts += 1;
      });
    }

    return { byShift, missingRate, pendingProduction, payrollWithoutShifts, professionalsWithoutShifts };
  }, [filteredShifts, getProf, productivityReport, appliedFilters, hasSearched, professionals, scopeUnitIds, isAllUnits]);

  const shiftCost = useCallback(shift => costModel.byShift.get(String(shift.id)) || 0, [costModel]);

  // Período quase vazio (começo do mês): oferece o mês passado.
  const lastMonthShiftCount = useMemo(() => {
    const [start, end] = periodRange('mes_passado');
    return shifts.filter(s => s && normalize(s.status) !== 'cancelado' &&
      (appliedFilters.sector === 'todos' || String(s.sector_id) === String(appliedFilters.sector)) &&
      String(s.date || '').slice(0, 10) >= start && String(s.date || '').slice(0, 10) <= end).length;
  }, [shifts, appliedFilters.sector]);
  const sparsePeriod = period === 'mes' && filteredShifts.length < 10 && lastMonthShiftCount > filteredShifts.length * 2;

  const reliabilityRows = useMemo(() => (isManager && hasSearched
    ? computeReliability({ shifts: filteredShifts, professionals, swaps: allCompanySwaps, start: appliedFilters.start, end: appliedFilters.end })
    : []), [isManager, hasSearched, filteredShifts, professionals, allCompanySwaps, appliedFilters]);

  const financialSummary = useMemo(() => {
    let totalCost = 0, executedCost = 0, pendingCost = 0, vacantCost = 0, totalHours = 0;
    filteredShifts.forEach(shift => {
      totalHours += getShiftHours(shift);
      const cost = shiftCost(shift);

      if (isVacant(shift)) {
        vacantCost += cost;
      } else {
        totalCost += cost;
        const status = normalize(shift.status);
        if (status === 'concluida' || status === 'concluido' || status === 'realizado' || isShiftPast(shift)) {
          executedCost += cost;
        } else {
          pendingCost += cost;
        }
      }
    });
    return {
      totalCost, executedCost, pendingCost, vacantCost,
      hours: roundHours(totalHours),
      shiftsMissingRate: costModel.missingRate.size,
      shiftsAwaitingProduction: costModel.pendingProduction.size,
      payrollWithoutShifts: costModel.payrollWithoutShifts,
      professionalsWithoutShifts: costModel.professionalsWithoutShifts,
      comparableTotal: totalCost + costModel.payrollWithoutShifts
    };
  }, [filteredShifts, shiftCost, costModel]);

  const sectorMetrics = useMemo(() => {
    const map = {};
    sectors.forEach(sector => {
      const n = normalize(sector.name);
      if (n && n !== 'setor' && !n.includes('setor geral')) {
        map[String(sector.id)] = { id: sector.id, name: titleCase(sector.name), total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
      }
    });

    filteredShifts.forEach(shift => {
      const id = String(shift.sector_id || 'unmapped');
      const sName = getSectorName(shift, sectors);
      if (!map[id]) map[id] = { id, name: titleCase(sName), total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
      
      const item = map[id];
      item.total += 1;
      item.hours += getShiftHours(shift);
      if (isVacant(shift)) item.vacant += 1;
      else item.filled += 1;
      item.cost += shiftCost(shift);
    });
    return Object.values(map).filter(item => item.total > 0).map(item => ({ ...item, hours: roundHours(item.hours) })).sort((a, b) => b.total - a.total);
  }, [sectors, filteredShifts, shiftCost]);

  const enrichedSectors = useMemo(() => {
    if (!hasSearched) return [];
    const term = normalize(appliedFilters.search);

    return sectors.filter(s => {
      const n = normalize(s.name);
      const spec = normalize(s.specialty);
      if (term && !n.includes(term) && !spec.includes(term)) return false;
      if (appliedFilters.sector !== 'todos' && String(s.id) !== String(appliedFilters.sector)) return false;
      return true;
    }).map(s => {
      const metric = sectorMetrics.find(m => String(m.id) === String(s.id));
      return {
        ...s,
        shiftsCount: metric ? metric.total : 0,
        totalCost: metric ? metric.cost : 0,
        totalHours: metric ? metric.hours : 0
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [sectors, sectorMetrics, appliedFilters, hasSearched]);

  const professionalMetrics = useMemo(() => {
    const map = {};
    // Agrupa pelo ID do profissional; o nome só é usado quando o plantão não
    // tem vínculo. Assim homônimos não se misturam e renomeações não duplicam linhas.
    filteredProfessionals.forEach(p => {
      if (!p.id && !normalize(p.name)) return;
      const key = p.id ? `id:${p.id}` : `nome:${normalize(p.name)}`;
      map[key] = {
        id: p.id || normalize(p.name),
        name: titleCase(p.name),
        specialty: p.specialty,
        shifts: 0, hours: 0, sectors: new Set(), cost: 0
      };
    });

    filteredShifts.forEach(shift => {
      if (isVacant(shift)) return;
      const prof = getProf(shift);
      let rawName = prof?.name || getShiftName(shift);
      let normName = normalize(rawName);
      if (!normName) {
        normName = `desconhecido_${shift.id}`;
        rawName = 'Profissional Não Identificado';
      }
      const professionalId = prof?.id || shift.professional_id;
      const key = professionalId ? `id:${professionalId}` : `nome:${normName}`;

      if (!map[key]) {
        map[key] = {
          id: professionalId || normName,
          name: titleCase(rawName),
          specialty: titleCase(prof?.specialty || 'Não Informada'),
          shifts: 0, hours: 0, sectors: new Set(), cost: 0
        };
      }

      const item = map[key];
      item.shifts += 1;
      const h = getShiftHours(shift);
      item.hours += h;
      const sName = getSectorName(shift, sectors);
      if (sName) item.sectors.add(titleCase(sName));
      item.cost += shiftCost(shift);
    });

    return Object.values(map).map(item => ({
      ...item,
      hours: roundHours(item.hours),
      sectors: item.sectors.size > 0 ? Array.from(item.sectors).join(', ') : '—' 
    })).sort((a, b) => b.shifts - a.shifts);
  }, [filteredShifts, filteredProfessionals, sectors, getProf, shiftCost]);

  const credentialAudit = useMemo(() => {
    let valid = 0, expired = 0, nearExpiry = 0, missing = 0;
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    filteredProfessionals.forEach(p => {
      const expiry = p.document_expiry || p.documentExpiry || p.valid_until || '';
      if (!expiry) { missing += 1; return; }
      const expiryDate = new Date(expiry);
      if (Number.isNaN(expiryDate.getTime())) { missing += 1; return; }
      
      expiryDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((expiryDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) expired += 1;
      else if (diffDays <= 30) nearExpiry += 1;
      else valid += 1;
    });

    return { valid, expired, nearExpiry, missing, total: filteredProfessionals.length };
  }, [filteredProfessionals]);

  const periodLabel = appliedFilters.start || appliedFilters.end
    ? `${appliedFilters.start ? formatDate(appliedFilters.start) : 'Início'} até ${appliedFilters.end ? formatDate(appliedFilters.end) : 'Hoje'}`
    : 'Todo o período';
  const currentUnitObj = (units || []).find(u => String(u.id) === String(selectedUnitId));
  const hospitalName = isAllUnits
    ? `${company?.name || 'Rede'} · Todas as unidades (${scopeUnitIds.length})`
    : currentUnitObj?.name || company?.name || 'Hospital Principal';
  const appliedSectorName = appliedFilters.sector === 'todos'
    ? 'Todos os setores'
    : sectors.find(sector => String(sector.id) === String(appliedFilters.sector))?.name || 'Setor selecionado';
  const appliedStatusName = appliedFilters.profStatus === 'todos'
    ? ''
    : `Profissionais ${appliedFilters.profStatus === 'ativo' ? 'ativos' : 'inativos'}`;
  const filterSummary = [
    appliedSectorName,
    appliedStatusName,
    appliedFilters.search ? `Busca: ${appliedFilters.search}` : ''
  ].filter(Boolean).join(' · ');
  const selectedProductivitySummary = productivityReport.professionalTotals.find(
    item => String(item.professional.id) === String(selectedProductivityProfessionalId)
  );
  const selectedProductivityRows = selectedProductivitySummary
    ? productivityReport.rows.filter(row => String(row.professional.id) === String(selectedProductivityProfessionalId))
    : [];
  const productivityProfessionalReportReady = productivityReport.available && Boolean(selectedProductivitySummary);

  // ==========================================
  // EXPORTAÇÃO EXCEL NATIVA
  // ==========================================
  const triggerExcelExport = (requestedMode) => exportReportExcel(requestedMode, { activeTab, appliedFilters, birthDaysList, enrichedSectors, filterSummary, filteredProfessionals, filteredShifts, financialSummary, hasSearched, hospitalName, periodLabel, productivityProfessionalReportReady, productivityReport, professionalMetrics, sectorMetrics, sectors, selectedProductivityRows, selectedProductivitySummary, selectedUnitId, shiftCost, swapsList });

  // ==========================================
  // IMPRESSÃO HTML PURA (Isolada, A4 Branco c/ Quebra) COM LOGOS
  // ==========================================
  const triggerPrint = (requestedMode) => printReport(requestedMode, { activeTab, birthDaysList, company, coverageRate, credentialAudit, currentUnitObj, enrichedSectors, filledShiftsCount, filterSummary, filteredProfessionals, filteredShifts, financialSummary, hasSearched, hospitalName, periodLabel, productivityProfessionalReportReady, productivityReport, professionalMetrics, sectorMetrics, sectors, selectedProductivityRows, selectedProductivitySummary, selectedUnitId, swapsList, totalShiftsCount, user, vacantShiftItems });

  const resultCountLabel =
    activeTab === 'bi' ? `${countLabel(filteredShifts.length, 'plantão', 'plantões')} no período` :
    activeTab === 'escalas' ? countLabel(filteredShifts.length, 'plantão', 'plantões') :
    activeTab === 'trocas' ? countLabel(swapsList.length, 'repasse', 'repasses') :
    activeTab === 'base_setores' ? countLabel(enrichedSectors.length, 'setor', 'setores') :
    activeTab === 'base_profissionais' ? countLabel(filteredProfessionals.length, 'profissional', 'profissionais') :
    activeTab === 'aniversariantes' ? countLabel(birthDaysList.length, 'aniversariante', 'aniversariantes') :
    activeTab === 'profissionais' ? countLabel(professionalMetrics.length, 'profissional', 'profissionais') :
    activeTab === 'confiabilidade' ? countLabel(reliabilityRows.length, 'profissional', 'profissionais') :
    activeTab === 'produtividade_diaria' ? `${productivityReport.totals.pendingDays} dia(s) pendente(s) · ${formatCurrency(productivityReport.totals.pool)} rateados` :
    activeTab === 'financeiro' ? `${formatCurrency(financialSummary.totalCost)} em custos previstos` :
    `${countLabel(totalShiftsCount, 'plantão', 'plantões')} analisados`;
  const activeGroup = REPORT_GROUPS.find(g => g.reports.includes(activeTab)) || REPORT_GROUPS[0];
  const groupReports = activeGroup.reports.map(id => reportNavigation.find(r => r.id === id)).filter(Boolean);
  const showStatusFilter = REPORTS_WITH_STATUS_FILTER.includes(activeTab);
  const fieldClass = 'h-10 text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 space-y-6 font-sans transition-colors duration-300">
      
      {/* TOPO EXECUTIVO */}
      <PageHero
        title="Relatórios"
        subtitle="Escolha o período para ver produtividade, furos de escala, corpo clínico e custos."
        actions={t => (
          <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
            <Button onClick={() => triggerExcelExport('current')} disabled={!hasSearched || (activeTab === 'produtividade_profissional' && !productivityProfessionalReportReady)} className={`font-medium text-sm h-10 px-4 rounded-xl gap-2 cursor-pointer shadow-none ${t.outline}`}>
              <FileSpreadsheet className={`w-4 h-4 ${t.outlineIcon}`} /> Exportar para Excel
            </Button>
            <Button onClick={() => triggerPrint('current')} disabled={!hasSearched || (activeTab === 'produtividade_profissional' && !productivityProfessionalReportReady)} className={`font-medium text-sm h-10 px-4 rounded-xl gap-2 cursor-pointer shadow-none font-semibold ${t.primary}`}>
              <PrinterIcon className="w-4 h-4" /> Imprimir / salvar PDF
            </Button>
          </div>
        )}
      />

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
          <nav aria-label="Grupos de relatórios" className="flex gap-1 overflow-x-auto">
            {REPORT_GROUPS.map(group => {
              const isActive = group.id === activeGroup.id;
              const first = group.reports.find(id => reportNavigation.some(r => r.id === id));
              if (!first) return null;
              return (
                <button key={group.id} type="button" aria-current={isActive ? 'page' : undefined}
                  onClick={() => !isActive && setActiveTab(first)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${isActive ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  {group.label}
                </button>
              );
            })}
          </nav>
          {groupReports.length > 1 && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-1 overflow-x-auto" role="tablist" aria-label={`Relatórios de ${activeGroup.label}`}>
              {groupReports.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${activeTab === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 w-full sm:w-44">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Período</Label>
              <Select value={period} onValueChange={choosePeriod}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent className="z-[99999]">
                  {PERIODS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {period === 'personalizado' && (
              <>
                <div className="space-y-1 w-[calc(50%-6px)] sm:w-40">
                  <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">De</Label>
                  <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className={fieldClass} />
                </div>
                <div className="space-y-1 w-[calc(50%-6px)] sm:w-40">
                  <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Até</Label>
                  <Input type="date" value={dateEnd} min={dateStart} onChange={e => setDateEnd(e.target.value)} className={fieldClass} />
                </div>
              </>
            )}
            <div className="space-y-1 w-full sm:w-56">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Setor</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                <SelectContent className="z-[99999] max-h-[300px]">
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {(sectors || []).map(sec => {
                    const sName = (sec.name || '').trim();
                    if (!sName || sName.toLowerCase() === 'setor' || sName.toLowerCase() === 'setor geral') return null;
                    return <SelectItem key={sec.id} value={String(sec.id)}>{sName}{isAllUnits && unitNameById[String(sec.unit_id)] ? ` · ${unitNameById[String(sec.unit_id)]}` : ''}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            {showStatusFilter && (
              <div className="space-y-1 w-full sm:w-40">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Situação</Label>
                <Select value={profStatusFilter} onValueChange={setProfStatusFilter}>
                  <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[99999]">
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="inativo">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</Label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input placeholder="Profissional ou setor" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`${fieldClass} pl-9`} />
              </div>
            </div>
            {filtersChanged && (
              <Button type="button" variant="ghost" onClick={handleClearFilters} className="h-10 px-3 text-sm text-slate-500 gap-1.5 cursor-pointer">
                <RotateCcw className="w-4 h-4" /> Limpar
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {periodLabel} · {filterSummary} · <span className="font-medium text-slate-700 dark:text-slate-200">{resultCountLabel}</span>
          </p>
          {sparsePeriod && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Este mês tem só {countLabel(filteredShifts.length, 'plantão', 'plantões')} até agora.{' '}
              <button type="button" onClick={() => choosePeriod('mes_passado')} className="font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">Ver o mês passado ({lastMonthShiftCount} plantões)</button>
            </p>
          )}
        </div>

      {!hasSearched ? null : (
        <div className="space-y-5">
          <div className="space-y-5">
            <OverviewReport activeTab={activeTab} coverageRate={coverageRate} credentialAudit={credentialAudit} filterSummary={filterSummary} filteredShifts={filteredShifts} financialSummary={financialSummary} hospitalName={hospitalName} isAllUnits={isAllUnits} periodLabel={periodLabel} professionalMetrics={professionalMetrics} scopeUnitIds={scopeUnitIds} sectorMetrics={sectorMetrics} sectors={sectors} setActiveTab={setActiveTab} shiftCost={shiftCost} unitNameById={unitNameById} vacantShiftItems={vacantShiftItems} />

            <ScheduleReports activeTab={activeTab} filteredShifts={filteredShifts} sectors={sectors} setShiftRowsLimit={setShiftRowsLimit} shiftRowsLimit={shiftRowsLimit} swapsList={swapsList} />

            <RegistryReports activeTab={activeTab} birthDaysList={birthDaysList} enrichedSectors={enrichedSectors} filteredProfessionals={filteredProfessionals} hospitalName={hospitalName} professionalMetrics={professionalMetrics} selectedUnitId={selectedUnitId} />

            <ProductivityReports activeTab={activeTab} hospitalName={hospitalName} periodLabel={periodLabel} productivityReport={productivityReport} selectedProductivityProfessionalId={selectedProductivityProfessionalId} selectedProductivityRows={selectedProductivityRows} selectedProductivitySummary={selectedProductivitySummary} setSelectedProductivityProfessionalId={setSelectedProductivityProfessionalId} />

            <ReliabilityReport activeTab={activeTab} isManager={isManager} reliabilityRows={reliabilityRows} />

            <FinancialReport activeTab={activeTab} financialSummary={financialSummary} sectorMetrics={sectorMetrics} />

          </div>
        </div>
      )}
      </div>
    </div>
  );
}