import { combineReducers } from 'redux';
import isFunction from 'lodash/isFunction';
import isArray from 'lodash/isArray';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import { actionConstants, methodNameToTypes, normalizeMethods } from './utils';

export { actionConstants };

export function createModel(options = {}) {
  let {
    typePrefix,
    modelState,
    modelsState,
    name = Math.random()
      .toString(36)
      .substring(7)
      .toUpperCase(),
    methods,
    mixins,
    reducer: modelReducer
  } = options;

  if (isFunction(modelsState) && !isFunction(modelState)) {
    modelState = modelsState;
  }

  if (!isFunction(modelState)) {
    modelState = state => state[name];
  }

  const _methods = normalizeMethods(methods, { mixins });

  const actions = {};
  createActions({
    typePrefix,
    modelName: name,
    methods: _methods,
    actions
  });

  const reducers = createReducers({
    typePrefix,
    modelName: name,
    methods: _methods,
    reducer: modelReducer,
    actions,
    mixins
  });

  const selectors = createSelectors({
    methods: _methods,
    mixins,
    actions,
    modelState
  });

  Object.keys(actions).forEach(name => (selectors[name] = actions[name]));
  selectors.modelName = name;
  selectors.reducer = combineReducers(reducers);
  selectors.reducers = { [name]: selectors.reducer };

  return selectors;
}

export function createActions({
  typePrefix,
  modelName,
  methods,
  actions,
  mixins
}) {
  (isArray(methods) ? methods : normalizeMethods(methods, { mixins })).forEach(
    ({ method, methodName, mixinName }) => {
      if (!actions[methodName]) {
        const [start, success, failure, reset] = methodNameToTypes({
          typePrefix,
          modelName,
          methodName
        });

        actions[methodName] = createAction({
          actions,
          modelName,
          methodName,
          method,
          types: { start, success, failure }
        });

        actions[methodName].modelName = modelName;
        actions[methodName].actionName = methodName;
        actions[methodName].mixinName = mixinName;

        actions[`${methodName}Reset`] = () => ({ type: reset });
        actions[`${methodName}Modify`] = (...params) => (result) => ({
          type: success,
          payload: { params, result }
        });
      } else {
        console.warn(
          `redux-models: (${modelName}) method${
            mixinName ? ` from mixin '${mixinName}'` : ''
          } with name '${methodName}' already defined${
            actions[methodName].mixinName
              ? ` in '${actions[methodName].mixinName}'`
              : ` in model methods`
          }`
        );
      }
    }
  );
}

function createAction({ modelName, methodName, method, types, actions }) {
  const { start, success, failure } = types;

  if (!isFunction(method)) {
    return params => ({ type: start, payload: { params, result: method } });
  }

  function startAction(params) {
    return { type: start, payload: { params } };
  }

  function successAction(params, result) {
    return { type: success, payload: { params, result } };
  }

  function failureAction(params, error) {
    return { type: failure, payload: { params, error } };
  }

  function createAction(...params) {
    function action(dispatch) {
      const result = method.call(actions, ...params);

      if (result && isFunction(result.then)) {
        dispatch(startAction(params));
        return result
          .then(result => {
            dispatch(successAction(params, result));
            return result;
          })
          .catch(error => {
            dispatch(failureAction(params, error));
            throw error;
          });
      }

      dispatch({ type: start, payload: { params, result, async: false } });

      return result;
    }

    action.actionParams = params;
    action.modelName = modelName;
    action.actionName = methodName;

    return action;
  }

  return createAction;
}

function createReducers({
  typePrefix,
  modelName,
  methods,
  reducer,
  actions,
  mixins
}) {
  const modelReducer =
    isFunction(reducer) &&
    ((state, action) =>
      reducer(
        state,
        action,
        methods.reduce(
          (constants, { methodName }) => ({
            ...constants,
            ...actionConstants({ typePrefix, modelName, methodName })
          }),
          {}
        )
      ));

  const mixinsReducers =
    isArray(mixins) &&
    mixins.reduce((reducers, { createReducer, name }) => {
      if (!isFunction(createReducer)) {
        console.error(
          `redux-models: createReducer is not defined in mixin ${name}`
        );
        return reducers;
      }

      const constants = methods
        .filter(({ methodName }) => actions[methodName].mixinName === name)
        .reduce(
          (constants, { methodName }) => ({
            ...constants,
            ...actionConstants({ typePrefix, modelName, methodName })
          }),
          {}
        );

      if (isEmpty(constants)) {
        return reducers;
      }

      return {
        ...reducers,
        [name]: createReducer(modelName, constants)
      };
    }, {});

  const methodsReducers = methods.filter(({ mixinName }) => !mixinName).reduce(
    (methodsReducers, { methodName }) => ({
      ...methodsReducers,
      [methodName]: createDefaultMethodReducer({
        types: methodNameToTypes({ typePrefix, modelName, methodName })
      })
    }),
    {}
  );

  return {
    ...methodsReducers,
    ...(modelReducer ? { model: modelReducer } : {}),
    ...(!isEmpty(mixinsReducers)
      ? { mixins: combineReducers(mixinsReducers) }
      : {})
  };
}

const resultInitialState = {
  params: null,
  result: null,
  requesting: false,
  requested: false,
  error: null,
  updatedAt: null
};

function createDefaultMethodReducer({ types }) {
  const [start, success, failure, reset] = types;

  return function defaultMethodReducer(state = [], action) {
    if (action.type === reset) {
      return [];
    }

    if (![start, success, failure].includes(action.type)) {
      return state;
    }

    const { params = null, result = null, error = null, async = true } =
      action.payload || {};

    const requesting = async ? action.type === start : false;
    const requested = async
      ? action.type === success || action.type === failure
      : true;
    const index = state.findIndex(row => isEqual(row.params, params));
    const updatedAt = Date.now();

    if (index === -1) {
      return [
        ...state,
        {
          ...resultInitialState,
          result,
          params,
          error,
          requesting,
          requested,
          updatedAt
        }
      ];
    }

    return [
      ...state.slice(0, index),
      {
        ...state[index],
        params,
        result:
          action.type === start
            ? state[index].result
            : action.type === success
              ? result
              : null,
        error,
        requesting,
        requested: true,
        updatedAt
      },
      ...state.slice(index + 1, state.length)
    ];
  };
}

function createSelector({ field, methodState }) {
  return (...params) => {
    const result =
      methodState.find(row => isEqual(params, row.params)) ||
      resultInitialState;

    return field ? result[field] : result;
  };
}

function createSelectors({ methods, modelState, mixins }) {
  const mixinsSelectors =
    isArray(mixins) &&
    mixins.length > 0 &&
    mixins.reduce((selectors, { createSelectors, name }) => {
      if (!isFunction(createSelectors)) {
        console.error(
          `redux-models: createSelectors is not defined in mixin ${name}`
        );
        return selectors;
      }

      return {
        ...selectors,
        [name]: state => createSelectors(state)
      };
    }, {});

  return storeState => {
    const state = modelState(storeState) || {};

    return methods.reduce((selectors, { methodName, mixinName }) => {
      if (mixinName) {
        const mixinState = (state.mixins || {})[mixinName] || {};
        return {
          ...mixinsSelectors[mixinName](mixinState),
          ...selectors
        };
      }

      const methodState = state[methodName] || [];
      return {
        ...selectors,
        [methodName]: createSelector({
          methodState,
          field: 'result'
        }),
        [`${methodName}Meta`]: createSelector({
          methodState
        })
      };
    }, {});
  };
}
