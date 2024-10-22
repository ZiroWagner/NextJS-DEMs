'use client'

import { useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import dynamic from 'next/dynamic'
import { Data } from 'plotly.js';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getPaginationRowModel,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from '@/components/ui/progress'
import { 
    linearInterpolation, leastSquaresFitting, lagrangeInterpolation, dividedDifferences, cubicSplineInterpolation, linearSplineInterpolation,gaussNewtonFitting, levenbergMarquardtFitting, evaluateModel, newtonRaphsonRegularized
  } from '@/lib/interpolation'

type RawData = Record<string, string | number>
type DataPoint = { 
  xOriginal: number; // Este se usará para los cálculos de interpolación
  xDisplay: number | string; // Este se usará para mostrar en el gráfico
  y: number 
}

export default function Home() {
  const [rawData, setRawData] = useState<RawData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [selectedXColumn, setSelectedXColumn] = useState<string>('')
  const [selectedYColumn, setSelectedYColumn] = useState<string>('')
  const [selectedMethod, setSelectMethod] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [inputX, setInputX] = useState<number>(20240101);
  const [calculatedY, setCalculatedY] = useState<number | null>(null);
  const [degree, setDegree] = useState<number>(3);

  // Estado para almacenar el historial de gráficos
  const [plotData, setPlotData] = useState<Data[]>([]);

  // Estado para controlar el tema
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  const columnHelper = createColumnHelper<RawData>()

  const tableColumns = columns.map(col => 
    columnHelper.accessor(col, {
      header: col,
      cell: info => info.getValue(),
    })
  )

  const table = useReactTable({
    data: rawData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setIsLoading(true)
      setProgress(0)
      const reader = new FileReader()
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as RawData[];
        setRawData(data);
        if (data.length > 0) {
          setColumns(Object.keys(data[0]));
        }
        setIsLoading(false);
      }

      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentLoaded = Math.round((e.loaded / e.total) * 100)
          setProgress(percentLoaded)
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }, [])

  // Función para convertir YYYYMMDD a una fecha válida
  const parseYYYYMMDD = (val: string) => {
    if (/^\d{8}$/.test(val)) { // Verificar que el formato sea YYYYMMDD
      const year = parseInt(val.substring(0, 4), 10);
      const month = parseInt(val.substring(4, 6), 10) - 1; // Mes empieza desde 0 en JS
      const day = parseInt(val.substring(6, 8), 10);
      return new Date(year, month, day).getTime(); // Convertir a timestamp
    }
    return NaN; // Si no es un formato válido, devolver NaN
  }

  const isDateFormat = (val: string) => {
    return /^\d{8}$/.test(val) || /^\d{4}[/-]?\d{2}[/-]?\d{2}$/.test(val) // Aceptar YYYYMMDD y YYYY-MM-DD
  }
  const processedData: DataPoint[] = useMemo(() => {
    if (!selectedXColumn || !selectedYColumn || !rawData.length) return [];
  
    return rawData.map(row => {
      const xValue = String(row[selectedXColumn]);
      let xOriginal: number; // Este se usará para los cálculos de interpolación
      let xDisplay: number | string; // Este se usará para mostrar en el gráfico
  
      if (isDateFormat(xValue)) {
        if (/^\d{8}$/.test(xValue)) {
          xOriginal = parseYYYYMMDD(xValue);
        } else {
          xOriginal = new Date(xValue).getTime();
        }
        xDisplay = xOriginal; // Mantener el valor como timestamp para el gráfico
      } else {
        xOriginal = Number(xValue);
        xDisplay = xOriginal;
      }
  
      const y = Number(row[selectedYColumn]);
  
      return { xOriginal, xDisplay, y };
    }).filter(point => !isNaN(point.xOriginal) && !isNaN(point.y));
  }, [rawData, selectedXColumn, selectedYColumn]);  
    

  const interpolate = useMemo(() => {
    if (!processedData.length) return null;
  
    const dataForInterpolation = processedData.map(p => ({ x: p.xOriginal, y: p.y }));
  
    switch (selectedMethod) {
      case 'lineal':
        return linearInterpolation(dataForInterpolation);
      case 'lagrange':
        return lagrangeInterpolation(dataForInterpolation);
      case 'diferencias-divididas':
        return dividedDifferences(dataForInterpolation);
      case 'splines-lineales':
        return linearSplineInterpolation(dataForInterpolation);
      case 'splines-cubicos':
        return cubicSplineInterpolation(dataForInterpolation);
      case 'minimos-cuadrados':
        return leastSquaresFitting(dataForInterpolation, degree);
      case 'gauss-newton': {
        const params = gaussNewtonFitting(dataForInterpolation, degree);
        return (x: number) => evaluateModel(params, x);
      }
      case 'levenber-marquardt': {
        const params = levenbergMarquardtFitting(dataForInterpolation, degree);
        return (x: number) => evaluateModel(params, x);
      }
      case 'newton-raphson': {
        const params = newtonRaphsonRegularized(dataForInterpolation, degree);
        return (x: number) => evaluateModel(params, x);
      }
      default:
        return null;
    }
  }, [selectedMethod, processedData, degree]);

  // Función para obtener un color aleatorio
  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  
  const interpolatedData = useMemo(() => {
    if (!interpolate) return [];
  
    const xMin = Math.min(...processedData.map(p => p.xOriginal));
    const xMax = Math.max(...processedData.map(p => p.xOriginal));
  
    const points: DataPoint[] = [];
    for (let x = xMin; x <= xMax; x += 60 * 60 * 1000) {
      points.push({ 
        xOriginal: x, 
        xDisplay: new Date(x).getTime(), // Convertir a fecha para el gráfico
        y: interpolate(x) 
      });
    }

    // Actualizar plotData con el nuevo gráfico del método seleccionado
    const newPlotData: Data[] = [
      ...plotData, // Mantener las líneas anteriores
      {
        x: points.map(d => new Date(d.xDisplay)), 
        y: points.map(d => d.y), 
        type: 'scatter', 
        mode: 'lines', 
        name: `Método: ${selectedMethod}`, // Nombre del método
        line: { color: getRandomColor() } // Color único para cada línea
      } as Data
    ];
    setPlotData(newPlotData);
    return points;
  }, [interpolate, processedData]);

  return (
    <main className={`px-4 pt-4 pb-2 m-2 rounded-lg w-full h-full overflow-auto ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-black'}`}>
      <div className='flex items-center justify-between mb-4'>
        <h1 className="text-3xl font-bold">MN - Interpolación y Ajuste</h1>

        {/* Botón de alternancia de modo noche */}
        <Button onClick={toggleDarkMode} className="btn bg-background hover:bg-slate-700 text-white font-medium">
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </Button>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Cargar Datos</h2>
        <Input type="file" onChange={handleFileUpload} accept=".csv,.xlsx" className={`mb-4 cursor-pointer ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}/>
        
        {isLoading && (
          <div className="mb-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500 mt-2">Cargando: {progress}%</p>
          </div>
        )}

        {columns.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Seleccionar Columnas</h3>
            <div className={`flex gap-4 ${isDarkMode ? 'text-white' : 'text-white'}`}>
              <Select onValueChange={setSelectedXColumn}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Seleccione columna X" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={setSelectedYColumn}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Seleccione columna Y" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {rawData.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="space-x-2 text-white">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
            </Button>
          </div>
          <span className="flex items-center gap-1">
            <div>Página</div>
            <strong>
              {table.getState().pagination.pageIndex + 1} de{' '}
              {table.getPageCount()}
            </strong>
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Método de Interpolación y Ajuste</h2>
        <div className="flex items-center justify-between text-white">
        <Select onValueChange={setSelectMethod}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Seleccione un método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lineal">Int: Interpolacion Lineal - Lento para Muchos Datos</SelectItem>
            <SelectItem value="lagrange">Int: Lagrange - No para Muchos Datos</SelectItem>
            <SelectItem value="diferencias-divididas">Int:Newton  - No para Muchos Datos</SelectItem>
            <SelectItem value="splines-lineales">Int: Splines-Lineales</SelectItem>
            <SelectItem value="splines-cubicos">Int: Splines-Cubicos</SelectItem>
            <SelectItem value="minimos-cuadrados">Ajuste: Mínimos cuadrados no lineales</SelectItem>
            <SelectItem value="gauss-newton">Ajuste: Gauss-Newton</SelectItem>
            <SelectItem value="levenber-marquardt">Ajuste: Levenberg-Marquardt</SelectItem>
            <SelectItem value="newton-raphson">Ajuste: Newton-Raphson</SelectItem>
          </SelectContent>
          {['minimos-cuadrados', 'gauss-newton', 'levenber-marquardt', 'newton-raphson'].includes(selectedMethod) && (
            <div className='flex items-center'>
              <label className="mr-4">Grado</label>
              <Input type="number" placeholder='3'
                value={degree ?? ''} 
                onChange={(e) => setDegree(Number(e.target.value))} 
              />
            </div>
          )}
        </Select>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Calcular f(x)</h2>
        <div className='flex items-center'>
          <Input 
            type="number" 
            placeholder="Ingrese un valor para X" 
            value={inputX ?? ''} 
            onChange={(e) => setInputX(Number(e.target.value))} 
            className="mr-2 text-white"
          />
          <Button className="btn bg-background text-white cursor-pointer hover:bg-slate-700 ml-2 font-semibold"
            onClick={() => {
              if (interpolate && inputX !== null) {
                setCalculatedY(interpolate(parseYYYYMMDD(inputX.toString())));
              }
            }}
            >
            Calcular
          </Button>
        </div>
        {calculatedY !== null && (
          <p className="mt-4">f({inputX}) = {calculatedY}</p>
        )}
      </div>

      {selectedXColumn && selectedYColumn && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Gráfica de Datos</h2>
          <Plot className='relative w-full overflow-auto rounded-lg border border-background'
            data={[
              {
                x: processedData.map(d => new Date(d.xDisplay)),
                y: processedData.map(d => d.y),
                type: 'scatter',
                mode: 'markers',
                marker: {color: 'blue'},
                name: 'Datos originales'
              },
              ...plotData, // Mantener todas las líneas generadas
              ...(calculatedY !== null ? [{
                x: [new Date(parseYYYYMMDD(inputX.toString()))],
                y: [calculatedY],
                type: 'scatter',
                mode: 'markers',
                marker: { color: 'green', size: 11 },
                name: `f(${inputX}) = ${calculatedY}`
              } as Data] : [])
            ]}
            layout={{
              width: 1250,
              height: 500,
              title: undefined,
              xaxis: {
                title: selectedXColumn,
                type: 'date', // Indicar que el eje X es una fecha
                tickformat: '%Y-%m-%d', // Formato de fecha en el gráfico
              },
              yaxis: {title: selectedYColumn}
            }}
          />
        </div>
      )}
    </main>
  )
}