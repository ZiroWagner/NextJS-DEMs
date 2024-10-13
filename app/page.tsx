'use client'

import { useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Progress } from '@/components/ui/progress'
import { vandermonde, minimosCuadrados, lagrange, diferenciasDivididas, newton, getPolynomialString } from '@/lib/interpolation'

type RawData = Record<string, string | number>
type DataPoint = { x: number; y: number }

export default function Home() {
  const [rawData, setRawData] = useState<RawData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [selectedXColumn, setSelectedXColumn] = useState<string>('')
  const [selectedYColumn, setSelectedYColumn] = useState<string>('')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [interpolationResult, setInterpolationResult] = useState<string>('')
  const [polynomialString, setPolynomialString] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)

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
        const bstr = e.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) as RawData[]
        setRawData(data)
        if (data.length > 0) {
          setColumns(Object.keys(data[0]))
        }
        setIsLoading(false)
      }
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentLoaded = Math.round((e.loaded / e.total) * 100)
          setProgress(percentLoaded)
        }
      }
      reader.readAsBinaryString(file)
    }
  }, [])

  const processedData: DataPoint[] = useMemo(() => {
    if (!selectedXColumn || !selectedYColumn) return []
    return rawData.map(row => ({
      x: Number(row[selectedXColumn]),
      y: Number(row[selectedYColumn])
    })).filter(point => !isNaN(point.x) && !isNaN(point.y))
  }, [rawData, selectedXColumn, selectedYColumn])

  const handleMethodChange = useCallback((value: string) => {
    setSelectedMethod(value)
    if (processedData.length === 0) return

    let interpolationFunction: (x: number) => number
    let coefficients: number[] = []

    try {
      switch (value) {
        case 'vandermonde':
          ({ interpolate: interpolationFunction, coefficients } = vandermonde(processedData))
          break
        case 'minimos-cuadrados':
          ({ interpolate: interpolationFunction, coefficients } = minimosCuadrados(processedData, 3)) // Using degree 3 for example
          break
        case 'lagrange':
          ({ interpolate: interpolationFunction } = lagrange(processedData))
          break
        case 'diferencias-divididas':
          ({ interpolate: interpolationFunction, coefficients } = diferenciasDivididas(processedData))
          break
        case 'newton':
          ({ interpolate: interpolationFunction, coefficients } = newton(processedData))
          break
        default:
          return
      }

      const polynomialStr = getPolynomialString(coefficients)
      setPolynomialString(polynomialStr)

      // Generate interpolation points
      const minX = Math.min(...processedData.map(p => p.x))
      const maxX = Math.max(...processedData.map(p => p.x))
      const step = (maxX - minX) / 100
      const interpolatedPoints = Array.from({ length: 101 }, (_, i) => {
        const x = minX + i * step
        return { x, y: interpolationFunction(x) }
      })

      setInterpolationResult(JSON.stringify(interpolatedPoints))
    } catch (error) {
      console.error("Error in interpolation:", error)
      setPolynomialString("Error en la interpolación")
      setInterpolationResult("")
    }
  }, [processedData])

  const chartData = useMemo(() => {
    if (!interpolationResult) return processedData
    const interpolatedPoints = JSON.parse(interpolationResult)
    return [...processedData, ...interpolatedPoints].sort((a, b) => a.x - b.x)
  }, [processedData, interpolationResult])

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Interpolación Polinómica</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Cargar Datos</h2>
        <Input type="file" onChange={handleFileUpload} accept=".csv,.xlsx" className="mb-4" />
        
        {isLoading && (
          <div className="mb-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500 mt-2">Cargando: {progress}%</p>
          </div>
        )}

        {columns.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Seleccionar Columnas</h3>
            <div className="flex gap-4">
              <Select onValueChange={setSelectedXColumn}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccione columna X" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={setSelectedYColumn}>
                <SelectTrigger className="w-[200px]">
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
          <div className="space-x-2">
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
        <h2 className="text-xl font-semibold mb-2">Método de Interpolación</h2>
        <Select onValueChange={handleMethodChange}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Seleccione un método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vandermonde">Sistema de ecuaciones de Vandermonde</SelectItem>
            <SelectItem value="minimos-cuadrados">Mínimos cuadrados no lineales</SelectItem>
            <SelectItem value="lagrange">Lagrange</SelectItem>
            <SelectItem value="diferencias-divididas">Diferencias divididas</SelectItem>
            <SelectItem value="newton">Newton</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedMethod && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Resultado de la Interpolación</h2>
          <p className="mb-2">Método seleccionado: {selectedMethod}</p>
          {polynomialString && (
            <p className="mb-2">Polinomio interpolante: {polynomialString}</p>
          )}
        </div>
      )}

      {selectedXColumn && selectedYColumn && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Gráfica de Datos y Polinomio Interpolante</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="linear" dataKey="y" stroke="#8884d8" name="Datos originales" dot={{ r: 4 }} />
              {interpolationResult && (
                <Line type="monotone" dataKey="y" stroke="#82ca9d" name="Interpolación" dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </main>
  )
}