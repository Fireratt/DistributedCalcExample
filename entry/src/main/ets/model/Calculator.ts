/*
 * Copyright (c) 2022 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const OPERATORLEVELS = {
  '+': 0,
  '-': 0,
  '*': 1,
  '/': 1,
}

const OPERATORHANDLERS = {
  '+': (firstOperand, secondOperand) => (parseFloat(firstOperand) + parseFloat(secondOperand)).toFixed(getFloatNum(firstOperand, secondOperand, '+')),
  '-': (firstOperand, secondOperand) => (firstOperand - secondOperand).toFixed(getFloatNum(firstOperand, secondOperand, '-')),
  '*': (firstOperand, secondOperand) => (firstOperand * secondOperand).toFixed(getFloatNum(firstOperand, secondOperand, '*')),
  '/': (firstOperand, secondOperand) => (firstOperand / secondOperand).toFixed(getFloatNum(firstOperand, secondOperand, '/')),
}

function getFloatNum(firstOperand, secondOperand, oprate) {
  let result = 0
  let oneString = (new String(firstOperand)).toString()
  let otherString = (new String(secondOperand)).toString()
  let firstNum = 0
  if (oneString.indexOf('.') !== -1) {
    firstNum = oneString.split('.')[1].length
  }
  let secondNum = 0
  if (otherString.indexOf('.') !== -1) {
    secondNum = otherString.split('.')[1].length
  }
  if (oprate === '+' || oprate === '-') {
    result = Math.max(firstNum, secondNum)
  }
  if (oprate === '*') {
    result = firstNum + secondNum
  }
  if (oprate === '/') {
    result = (firstNum + otherString.length) > 3 ? (firstNum + otherString.length) : 3
  }
  return result
}

function calcSuffixExpression(expression) {
  const numberStack = []
  while (expression.length) {
    let element = expression.shift()
    if (!isOperator(element)) {
      numberStack.push(element)
    } else {
      const firstStackElement = numberStack.pop()
      const secondStackElement = numberStack.pop()
      const result = OPERATORHANDLERS[element](secondStackElement, firstStackElement)
      numberStack.push(formatResult(result))
    }
  }
  return numberStack[0]
}

function formatResult(result: string): string {
  if (result.length > 15) {
    return parseFloat(result).toExponential()
  }
  return result
}

function trimTrailingZeros(result: string): string {
  if (result.indexOf('.') === -1 || result.indexOf('e') !== -1 || result.indexOf('E') !== -1) {
    return result
  }
  const trimResult = result.replace(/\.?0+$/, '')
  return trimResult === '-0' ? '0' : trimResult
}

function toSuffixExpression(expression) {
  const operatorStack = []
  const suffixExpression = []
  let topOperator
  for (let index = 0, size = expression.length; index < size; ++index) {
    const element = expression[index]
    if (element === '(') {
      operatorStack.push(element)
      continue
    }
    if (element === ')') {
      while (operatorStack.length && operatorStack[operatorStack.length - 1] !== '(') {
        suffixExpression.push(operatorStack.pop())
      }
      if (operatorStack.length && operatorStack[operatorStack.length - 1] === '(') {
        operatorStack.pop()
      }
      continue
    }
    if (isOperator(element)) {
      if (!operatorStack.length) {
        operatorStack.push(element)
      } else {
        topOperator = operatorStack[operatorStack.length - 1]
        if (!isGrouping(topOperator) && !isPrioritized(element, topOperator)) {
          while (operatorStack.length && !isGrouping(operatorStack[operatorStack.length - 1]) &&
            !isPrioritized(element, operatorStack[operatorStack.length - 1])) {
            suffixExpression.push(operatorStack.pop())
          }
        }
        operatorStack.push(element)
      }
      continue
    }
    suffixExpression.push(element)
  }
  while (operatorStack.length) {
    suffixExpression.push(operatorStack.pop())
  }
  return suffixExpression
}

function parseInfixExpression(inputContent) {
  const size = inputContent.length
  const lastIndex = size - 1
  let singleChar = ''
  const expression = []
  for (let index = 0; index < size; index++) {
    const element = inputContent[index]
    if (isGrouping(element)) {
      if (singleChar !== '') {
        expression.push(singleChar)
        singleChar = ''
      }
      expression.push(element)
    } else if (isOperator(element)) {
      if (isSymbol(element) && (index === 0 || inputContent[index - 1] === '(')) {
        singleChar += element
      } else {
        if (singleChar !== '') {
          expression.push(singleChar)
          singleChar = ''
        }
        if (index !== lastIndex) {
          expression.push(element)
        }
      }
    } else {
      singleChar += element
    }
    if (index === lastIndex && singleChar !== '') {
      expression.push(singleChar)
    }
  }
  return expression
}

function isPrioritized(firstOperator, secondOperator) {
  return OPERATORLEVELS[firstOperator] > OPERATORLEVELS[secondOperator]
}

export function isOperator(operator: string): boolean {
  return (
    operator === '+' || operator === '-' || operator === '*' || operator === '/'
  )
}

function isSymbol(symbol) {
  return symbol === '+' || symbol === '-'
}

function isGrouping(operator) {
  return operator === '(' || operator === ')'
}

export function calc(inputContent: string): string {
  const infixExpression = parseInfixExpression(inputContent)
  const suffixExpression = toSuffixExpression(infixExpression)
  return calcSuffixExpression(suffixExpression)
}

export function square(inputContent: string): string {
  const result = calc(inputContent)
  if (result === '' || result === undefined) {
    return ''
  }
  const operand = trimTrailingZeros(result)
  return trimTrailingZeros(formatResult(OPERATORHANDLERS['*'](operand, operand)))
}

export function percent(inputContent: string): string {
  const result = calc(inputContent)
  if (result === '' || result === undefined) {
    return ''
  }
  return trimTrailingZeros(formatResult(OPERATORHANDLERS['/'](result, '100')))
}

export function squareRoot(inputContent: string): string {
  const result = calc(inputContent)
  if (result === '' || result === undefined) {
    return ''
  }
  const numberResult = parseFloat(result)
  if (numberResult < 0 || isNaN(numberResult)) {
    return ''
  }
  return trimTrailingZeros(formatResult(Math.sqrt(numberResult).toString()))
}
