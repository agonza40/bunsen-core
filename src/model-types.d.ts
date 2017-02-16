import {JSONSchema} from './json-schema'

export interface BunsenModel extends JSONSchema {}

export interface Condition {
  equals?:any;
  notEquals?:any;
  greaterThan?:any;
  lessThan?:any;
  contains?:any;
}

export interface ConditionSet {
  if?: Condition[];
  unless?: Condition[];
  then?: BunsenModel
}