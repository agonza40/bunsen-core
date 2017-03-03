import {JSONSchema} from './json-schema'

export interface BunsenModel extends JSONSchema {
  conditions: ConditionSet[]
  items?: BunsenModel[] | BunsenModel
  properties?:{[index:string]:BunsenModel}
  patternProperties?:{[index:string]:BunsenModel}
  additionalProperties?:boolean | BunsenModel
  required?:string[]
  definitions?: BunsenModelSet
  dependencies?: {[key: string]: BunsenModel | string[]}
  allOf?: BunsenModel[]
  anyOf?: BunsenModel[]
  oneOf?: BunsenModel[]
  not?: BunsenModel
}

export interface Condition {
  equals?:any
  notEquals?:any
  greaterThan?:any
  lessThan?:any
  contains?:any
}

export interface ConditionSet {
  if?: Condition[]
  unless?: Condition[]
  then?: BunsenModel
}

export interface BunsenModelSet {
  [index:string]:BunsenModel
}

/**
 * @typedef {Object} BunsenDereferenceResult
 * The result of dereferencing a schema
 * @property {BunsenValidationError[]} errors - the list of errors encountered during dereferencing
 * @property {String[]} refs - the list of references which were encountered/processed
 * @property {Object} schema - the dereferenced schema
 */
export interface BunsenDereferenceResult {
  errors: BunsenValidationError[]
  refs: string[]
  schema: BunsenModel
}

/**
 * @typedef {Object} BunsenValidationError
 * @property {Boolean} isRequiredError - whether or not error is a required field error
 * @property {String} message - the error message
 * @property {String} path - the dotted path to the attribute where the error occurred
 */
export interface BunsenValidationError {
  isRequiredError?: boolean
  message: string
  path: string
}

/**
 * @typedef BunsenValidationResult
 * @property {BunsenValidationError[]} errors - the errors (if any)
 * @property {BunsenValidationWarning[]} warnings - the warnings (if any)
 */
export interface BunsenValidationResult {
  errors: BunsenValidationError[]
  warnings: BunsenValidationWarning[]
}

/**
 * @typedef BunsenValidationWarning
 * @property {String} path - the dotted path to the attribute where the error occurred
 * @property {String} message - the warning message
 */
export interface BunsenValidationWarning {
  path: string
  message: string
}

interface State {
  lastAction: null | string
  errors: {}
  validationResult: BunsenValidationResult
  value: any
  model: {} // Model calculated by the reducer
  baseModel: {} // Original model recieved,
  baseView: any
  valueChangeSet: null
}