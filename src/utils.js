import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import snakeCase from 'lodash/snakeCase';

export const defaultTypePrefix = '@@redux-models';

export function normalizeMethods(methods) {
  return isArray(methods)
    ? methods
        .map(method => ({
          methodName: isString(method) ? method : method.name,
          method
        }))
        .filter(({ methodName }) => !!methodName)
    : Object.keys(methods).map(methodName => ({
        methodName,
        method: methods[methodName]
      }));
}

export function methodNameToTypes({ typePrefix, modelName, methodName }) {
  const type = `${typePrefix || defaultTypePrefix}/${snakeCase(
    modelName
  ).toUpperCase()}/${snakeCase(methodName).toUpperCase()}`;
  return [type, `${type}_SUCCESS`, `${type}_ERROR`, `${type}_RESET`];
}

export function actionConstants({ typePrefix, modelName, methodName }) {
  const [start, success, error, reset] = methodNameToTypes({
    typePrefix,
    modelName,
    methodName
  });

  const type = snakeCase(methodName).toUpperCase();

  return {
    [type]: start,
    [methodName]: start,
    [`${type}_SUCCESS`]: success,
    [`${methodName}Success`]: success,
    [`${type}_ERROR`]: error,
    [`${methodName}Error`]: error,
    [`${type}_RESET`]: reset,
    [`${methodName}Reset`]: reset
  };
}
