import { inv, transpose, multiply, add, identity, lusolve, norm, Matrix, matrix } from 'mathjs';

type DataPoint = {
  x: number;
  y: number;
};

export function linearInterpolation(points: DataPoint[]): (x: number) => number {
  return (x: number) => {
    for (let i = 0; i < points.length - 1; i++) {
      const { x: x0, y: y0 } = points[i];
      const { x: x1, y: y1 } = points[i + 1];
      if (x0 <= x && x <= x1) {
        return y0 + ((y1 - y0) / (x1 - x0)) * (x - x0);
      }
    }
    throw new Error('El valor x está fuera del rango de los puntos proporcionados.');
  };
}

export function lagrangeInterpolation(points: DataPoint[]): (x: number) => number {
  return (x: number) => {
    return points.reduce((sum, pointI, i) => {
      const term = points.reduce((product, pointJ, j) => {
        if (i !== j) {
          return product * (x - pointJ.x) / (pointI.x - pointJ.x);
        }
        return product;
      }, 1);
      return sum + pointI.y * term;
    }, 0);
  };
}

export function dividedDifferences(points: DataPoint[]): (x: number) => number {
  const n = points.length;
  const table = points.map(p => [p.y]);
  
  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      const diff = (table[i + 1][j - 1] - table[i][j - 1]) / (points[i + j].x - points[i].x);
      table[i].push(diff);
    }
  }

  return (x: number) => {
    let result = table[0][0];
    let product = 1;
    for (let i = 1; i < n; i++) {
      product *= (x - points[i - 1].x);
      result += product * table[0][i];
    }
    return result;
  };
}

//-->Metodos de Interpolación más eficientes para gran cantidad de Datos:
// Interpolación por Splines Lineales
export function linearSplineInterpolation(data: { x: number, y: number }[]) {
  // Verifica que haya suficientes puntos de datos
  if (data.length < 2) {
    throw new Error('Se requieren al menos dos puntos de datos para la interpolación lineal por splines.');
  }

  // Ordena los puntos de datos según los valores de x
  const sortedData = [...data].sort((a, b) => a.x - b.x);

  return (x: number) => {
    // Encuentra el intervalo en el que x se encuentra
    for (let i = 0; i < sortedData.length - 1; i++) {
      const x0 = sortedData[i].x;
      const x1 = sortedData[i + 1].x;
      const y0 = sortedData[i].y;
      const y1 = sortedData[i + 1].y;

      // Si x está entre x0 y x1, calcula la interpolación lineal
      if (x >= x0 && x <= x1) {
        const t = (x - x0) / (x1 - x0); // Calcula la proporción
        return y0 * (1 - t) + y1 * t; // Interpolación lineal
      }
    }

    // Si x está fuera del rango de los datos, devuelve null o un valor predeterminado
    return 0;
  };
}

// Interpolación por Splines Cubicos
type SplineCoefficient = {
  a: number;
  b: number;
  c: number;
  d: number;
  x: number;
};

export function cubicSplineInterpolation(points: DataPoint[]): (x: number) => number {
  const n = points.length - 1;
  const h = Array(n);
  const alpha = Array(n);

  // Paso 1: Calcular los valores h[i] y alpha[i]
  for (let i = 0; i < n; i++) {
    h[i] = points[i + 1].x - points[i].x;
    alpha[i] =
      (3 * (points[i + 1].y - points[i].y) / h[i]) -
      (3 * (points[i].y - points[i - 1]?.y || 0) / h[i - 1] || 0);
  }

  // Paso 2: Crear y resolver el sistema tridiagonal
  const l = Array(n + 1).fill(1);
  const mu = Array(n).fill(0);
  const z = Array(n + 1).fill(0);

  for (let i = 1; i < n; i++) {
    l[i] = 2 * (points[i + 1].x - points[i - 1].x) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  // Paso 3: Calcular los coeficientes c, b y d
  const c = Array(n + 1).fill(0);
  const b = Array(n).fill(0);
  const d = Array(n).fill(0);
  const a = points.map(p => p.y);

  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (a[j + 1] - a[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  // Paso 4: Crear las funciones para cada segmento
  const splines: SplineCoefficient[] = [];
  for (let i = 0; i < n; i++) {
    splines.push({
      a: a[i],
      b: b[i],
      c: c[i],
      d: d[i],
      x: points[i].x,
    });
  }

  // Paso 5: Definir la función de interpolación
  return (x: number) => {
    let spline = splines[0];
    for (let i = 0; i < splines.length; i++) {
      if (x >= splines[i].x) {
        spline = splines[i];
      } else {
        break;
      }
    }
    const dx = x - spline.x;
    return spline.a + spline.b * dx + spline.c * Math.pow(dx, 2) + spline.d * Math.pow(dx, 3);
  };
}


// Metodos de Ajuste de curva no lineal
export function leastSquaresFitting(points: DataPoint[], degree: number): (x: number) => number {
  const A = points.map(point => Array.from({ length: degree + 1 }, (_, i) => Math.pow(point.x, i)));
  const y = points.map(point => point.y);
  const AT = transpose(A);
  const ATA = multiply(AT, A);
  const ATy = multiply(AT, y);
  const coeffs = multiply(inv(ATA), ATy);

  return (x: number) =>
    coeffs.reduce((sum, coeff, i) => sum + coeff * Math.pow(x, i), 0);
}

// Método de Mínimos Cuadrados Exclusivo para Generar Valores Iniciales -> InitialGuess
function leastSquaresInitialGuess(points: DataPoint[], degree: number): number[] {
  const A = points.map(point => Array.from({ length: degree + 1 }, (_, i) => Math.pow(point.x, i)));
  const y = points.map(point => point.y);
  const AT = transpose(A);
  const ATA = multiply(AT, A);
  const ATy = multiply(AT, y);
  const coeffs = multiply(inv(ATA), ATy);

  return coeffs; // Retorna los coeficientes que se usarán como conjetura inicial
}

// Modificación en el método Gauss-Newton para usar la conjetura inicial
export function gaussNewtonFitting(
  points: DataPoint[],
  degree: number, // Nuevo parámetro para definir el grado del polinomio
  maxIterations: number = 100,
  tolerance: number = 1e-6
): number[] {
  let params = leastSquaresInitialGuess(points, degree); // Genera la conjetura inicial usando mínimos cuadrados

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const J = points.map(({ x }) =>
      params.map((_, i) => Math.pow(x, i)) // Derivadas parciales de la función
    );
    const r = points.map(({ x, y }) =>
      params.reduce((sum, p, i) => sum + p * Math.pow(x, i), 0) - y // Residuos
    );

    const JT = transpose(J);
    const JTJ = multiply(JT, J);
    const JTr = multiply(JT, r);
    const delta = multiply(inv(JTJ), JTr);

    // Actualizamos los parámetros
    params = params.map((p, i) => p - delta[i]);

    // Criterio de convergencia
    if (Math.sqrt(delta.reduce((sum, d) => sum + d ** 2, 0)) < tolerance) {
      break;
    }
  }

  return params;
}

// Modificación en el método Levenberg-Marquardt para usar la conjetura inicial
export function levenbergMarquardtFitting(data: DataPoint[], degree: number, lambda: number = 0.01, regularizationFactor = 0.001): number[] {
  const n = data.length;
  const X = data.map(point => point.x);
  const Y = data.map(point => point.y);

  // Inicializamos los coeficientes del polinomio (valores iniciales en 0)
  let params = new Array(degree + 1).fill(0);
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let iter = 0; iter < maxIterations; iter++) {
      // Construimos la matriz jacobiana y el vector de errores
      const J: number[][] = [];
      const errors: number[] = [];

      for (let i = 0; i < n; i++) {
          const xi = X[i];
          const yi = Y[i];
          const fxi = evaluateModel(params, xi); // Modelo evaluado con los parámetros actuales
          const error = yi - fxi; // Error actual

          // Gradientes parciales con respecto a los coeficientes
          const gradient: number[] = [];
          for (let j = 0; j <= degree; j++) {
              gradient.push(Math.pow(xi, j)); // Derivada del polinomio con respecto a cada parámetro
          }

          J.push(gradient); // Agregamos el gradiente a la matriz jacobiana
          errors.push(error); // Agregamos el error
      }

      // Convertimos la matriz jacobiana y el vector de errores a matrices de mathjs
      const JT = transpose(matrix(J)) as Matrix; // Convertimos J a Matrix y luego transponemos
      const JJT = multiply(JT, matrix(J)) as Matrix; // Multiplicamos JT y J (ambas matrices)

      const regMatrix = multiply(identity(degree + 1), regularizationFactor) as Matrix; // Matriz de regularización

      // Levenberg-Marquardt update step: (J^T * J + lambda * I) * delta = J^T * error
      const H = add(JJT, multiply(lambda, regMatrix)) as Matrix; // Hessiano con regularización
      const gradientStep = multiply(JT, matrix(errors)) as Matrix; // Paso de gradiente, convertimos el vector de errores en matriz

      // Resolver el sistema de ecuaciones para obtener delta (ajuste de los parámetros)
      const deltaParamsMatrix = lusolve(H, gradientStep) as Matrix;

      // Aseguramos que deltaParams sea un array unidimensional
      const deltaParams = (deltaParamsMatrix.toArray() as number[][]).flat(); // Convertimos la matriz a un array unidimensional

      // Actualizamos los parámetros
      params = add(params, deltaParams) as number[];

      // Verificamos la convergencia (si el cambio en los parámetros es pequeño)
      const deltaNorm = norm(deltaParams) as number; // Ahora deltaParams es un vector y podemos calcular la norma
      if (deltaNorm < tolerance) {
          break;
      }
  }

  return params;
}

export function newtonRaphsonRegularized(
  data: DataPoint[],
  degree: number,
  lambda: number = 0.001, // Regularización por defecto
  tolerance: number = 1e-6,
  maxIterations: number = 100
): number[] {
  //const n = data.length;
  const X = createDesignMatrix(data, degree);
  const y = data.map(point => point.y);

  // Inicializamos los coeficientes (parámetros) como un vector de ceros
  let params = new Array(degree + 1).fill(0);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Calcular el residuo (error) entre los valores reales y los predichos
    const residuals = y.map((yi, i) => yi - evaluatePolynomial(X[i], params));

    // Calcular la matriz Jacobiana
    const J = calculateJacobian(X);

    // Calcular la transpuesta de la matriz Jacobiana
    const JT = transposeMatrix(J);

    // Calcular la actualización de los parámetros
    const JTJ = matrixMultiply(JT, J); // JT * J
    const JTr = matrixVectorMultiply(JT, residuals); // JT * r

    // Regularización de tipo L2 (Ridge)
    const regularizationMatrix = JTJ.map((row, i) =>
      row.map((val, j) => (i === j ? val + lambda : val))
    );

    // Resolviendo el sistema lineal: (JTJ + lambda * I) * deltaParams = JT * r
    const deltaParams = solveLinearSystem(regularizationMatrix, JTr);

    // Actualizar los parámetros
    params = params.map((p, i) => p + deltaParams[i]);

    // Comprobar convergencia
    if (Math.max(...deltaParams.map(Math.abs)) < tolerance) {
      break; // Converge si la actualización es menor a la tolerancia
    }
  }

  return params;
}

/**
 * Evaluar el polinomio en una fila de la matriz de diseño X.
 * @param row - Fila de la matriz de diseño.
 * @param params - Parámetros del polinomio.
 * @returns El valor del polinomio evaluado.
 */
function evaluatePolynomial(row: number[], params: number[]): number {
  return row.reduce((sum, x, i) => sum + x * params[i], 0);
}

/**
 * Crear la matriz de diseño X basada en los datos y el grado del polinomio.
 * @param data - Puntos de datos {x, y}.
 * @param degree - Grado del polinomio.
 * @returns Matriz de diseño X.
 */
function createDesignMatrix(data: DataPoint[], degree: number): number[][] {
  return data.map(point => {
    const row = [];
    for (let i = 0; i <= degree; i++) {
      row.push(Math.pow(point.x, i)); // X^i
    }
    return row;
  });
}

/**
 * Calcular la matriz Jacobiana.
 * @param X - Matriz de diseño.
 * @param params - Parámetros actuales.
 * @returns La matriz Jacobiana.
 */
function calculateJacobian(X: number[][]): number[][] {
  return X.map(row => row.map((_, j) => row[j]));
}

/**
 * Transponer una matriz.
 * @param matrix - Matriz a transponer.
 * @returns Matriz transpuesta.
 */
function transposeMatrix(matrix: number[][]): number[][] {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

/**
 * Multiplicar dos matrices.
 * @param A - Primera matriz.
 * @param B - Segunda matriz.
 * @returns El resultado de la multiplicación de matrices.
 */
function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < A.length; i++) {
    result[i] = [];
    for (let j = 0; j < B[0].length; j++) {
      result[i][j] = 0;
      for (let k = 0; k < A[0].length; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

/**
 * Multiplicar una matriz por un vector.
 * @param A - Matriz.
 * @param v - Vector.
 * @returns El resultado de la multiplicación.
 */
function matrixVectorMultiply(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
}

/**
 * Resolver un sistema de ecuaciones lineales.
 * @param A - Matriz de coeficientes.
 * @param b - Vector de resultados.
 * @returns El vector solución.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  // Aquí puedes usar cualquier algoritmo para resolver sistemas de ecuaciones lineales
  // como eliminación de Gauss, descomposición LU, o usar una librería optimizada.
  // Por simplicidad, se usa una función externa (esto puede ser una librería como math.js o lapack).
  return gaussianElimination(A, b);
}

/**
 * Resolver un sistema de ecuaciones lineales usando eliminación de Gauss.
 * @param A - Matriz de coeficientes.
 * @param b - Vector de resultados.
 * @returns El vector solución.
 */
function gaussianElimination(A: number[][], b: number[]): number[] {
  // Implementación básica de eliminación de Gauss.
  // Si deseas optimización, usa una librería especializada.
  const n = A.length;
  for (let i = 0; i < n; i++) {
    // Encontrar el pivote máximo
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }

    // Intercambiar filas
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    // Hacer cero las entradas por debajo del pivote
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      b[k] += c * b[i];
    }
  }

  // Resolver sustitución hacia atrás
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = b[i] / A[i][i];
    for (let k = i - 1; k >= 0; k--) {
      b[k] -= A[k][i] * x[i];
    }
  }
  return x;
}

export function evaluateModel(params: number[], x: number): number {
  return params.reduce((sum, coeff, i) => sum + coeff * Math.pow(x, i), 0);
}