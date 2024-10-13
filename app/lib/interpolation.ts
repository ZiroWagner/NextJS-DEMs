import { Matrix, multiply, transpose, pinv } from 'mathjs';

type DataPoint = {
  x: number;
  y: number;
};

export function vandermonde(data: DataPoint[]): { interpolate: (x: number) => number, coefficients: number[] } {
  const X = data.map(point => Array.from({ length: data.length }, (_, i) => Math.pow(point.x, i)));
  const y = data.map(point => [point.y]);
  
  try {
    const coefficients = multiply(pinv(X), y) as number[][];
    const flatCoefficients = coefficients.map(c => c[0]);

    return {
      interpolate: (x: number) => {
        return flatCoefficients.reduce((sum, coeff, i) => sum + coeff * Math.pow(x, i), 0);
      },
      coefficients: flatCoefficients
    };
  } catch (error) {
    console.error("Error in Vandermonde interpolation:", error);
    return {
      interpolate: () => NaN,
      coefficients: []
    };
  }
}

export function minimosCuadrados(data: DataPoint[], degree: number): { interpolate: (x: number) => number, coefficients: number[] } {
  const X = data.map(point => Array.from({ length: degree + 1 }, (_, i) => Math.pow(point.x, i)));
  const y = data.map(point => [point.y]);
  const Xt = transpose(X);
  
  try {
    const coefficients = multiply(pinv(multiply(Xt, X)), multiply(Xt, y)) as number[][];
    const flatCoefficients = coefficients.map(c => c[0]);

    return {
      interpolate: (x: number) => {
        return flatCoefficients.reduce((sum, coeff, i) => sum + coeff * Math.pow(x, i), 0);
      },
      coefficients: flatCoefficients
    };
  } catch (error) {
    console.error("Error in Mínimos Cuadrados interpolation:", error);
    return {
      interpolate: () => NaN,
      coefficients: []
    };
  }
}

export function lagrange(data: DataPoint[]): { interpolate: (x: number) => number, coefficients: number[] } {
  const interpolate = (x: number) => {
    return data.reduce((sum, point, i) => {
      const li = data.reduce((prod, otherPoint, j) => {
        if (i === j) return prod;
        return prod * (x - otherPoint.x) / (point.x - otherPoint.x);
      }, 1);
      return sum + point.y * li;
    }, 0);
  };

  // Lagrange no tiene coeficientes en la forma polinómica estándar
  return { interpolate, coefficients: [] };
}

export function diferenciasDivididas(data: DataPoint[]): { interpolate: (x: number) => number, coefficients: number[] } {
  const n = data.length;
  const f: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    f[i][0] = data[i].y;
  }

  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      f[i][j] = (f[i + 1][j - 1] - f[i][j - 1]) / (data[i + j].x - data[i].x);
    }
  }

  const interpolate = (x: number) => {
    let result = f[0][0];
    let term = 1;
    for (let i = 1; i < n; i++) {
      term *= (x - data[i - 1].x);
      result += f[0][i] * term;
    }
    return result;
  };

  // Los coeficientes son los f[0][i], pero no están en la forma polinómica estándar
  return { interpolate, coefficients: f[0] };
}

export function newton(data: DataPoint[]): { interpolate: (x: number) => number, coefficients: number[] } {
  const n = data.length;
  const f: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    f[i][0] = data[i].y;
  }

  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      f[i][j] = (f[i + 1][j - 1] - f[i][j - 1]) / (data[i + j].x - data[i].x);
    }
  }

  const interpolate = (x: number) => {
    let result = f[0][0];
    let term = 1;
    for (let i = 1; i < n; i++) {
      term *= (x - data[i - 1].x);
      result += f[0][i] * term;
    }
    return result;
  };

  // Los coeficientes son los f[0][i], pero no están en la forma polinómica estándar
  return { interpolate, coefficients: f[0] };
}

export function getPolynomialString(coefficients: number[]): string {
  if (!coefficients || coefficients.length === 0) {
    return "No se pudo generar el polinomio";
  }

  return coefficients.map((coeff, i) => {
    if (coeff === 0) return '';
    const term = i === 0 ? `${coeff.toFixed(4)}` :
                 i === 1 ? `${coeff.toFixed(4)}x` :
                 `${coeff.toFixed(4)}x^${i}`;
    return coeff > 0 ? `+ ${term}` : `- ${term.slice(1)}`;
  }).filter(term => term !== '').join(' ').replace(/^\+ /, '') || '0';
}