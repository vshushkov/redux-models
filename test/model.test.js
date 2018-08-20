import expect from 'expect';
import configureMockStore from 'redux-mock-store';
import sinon from 'sinon';
import thunk from 'redux-thunk';
import { createModel } from '../src';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('Model', () => {
  it('create a model with async method', () => {
    const responseData = ({ username, password }) => `${username}, ${password}`;

    const user = createModel({
      name: 'user',
      stateToModel: state => state,
      methods: {
        login: ({ username, password }) => {
          return Promise.resolve(responseData({ username, password }));
        }
      }
    });

    const params = {
      username: 'username',
      password: 'password'
    };

    let state = {};
    const expectedActions = [
      { payload: [params], type: '@@redux-models/USER/LOGIN_START' },
      {
        payload: [params],
        type: '@@redux-models/USER/LOGIN_SUCCESS',
        meta: responseData(params)
      }
    ];

    const store = mockStore();
    const action = user.login(params);

    expect(action.asyncAction).toEqual(true);
    expect(action.actionName).toEqual('login');
    expect(action.actionParams).toEqual([params]);
    expect(action.modelName).toEqual('user');

    return store
      .dispatch(user.login(params))
      .then(response => {
        expect(response).toEqual(responseData(params));

        sinon.stub(Date, 'now').callsFake(() => 1);

        let selector = user.selectors(state).login(params);
        expect(selector).toEqual({
          result: null,
          requesting: false,
          requested: false
        });

        let selectorResult = user.selectors(state).loginResult(params);
        expect(selectorResult).toEqual(null);

        state = user.reducer(state, expectedActions[0]);

        expect(state).toEqual({
          login: [
            {
              params: [params],
              result: null,
              requesting: true,
              requested: false,
              error: null,
              updatedAt: 1
            }
          ]
        });

        selector = user.selectors(state).login(params);
        expect(selector).toEqual({
          error: null,
          params: [params],
          result: null,
          requesting: true,
          requested: false,
          updatedAt: 1
        });

        selectorResult = user.selectors(state).loginResult(params);
        expect(selectorResult).toEqual(null);

        state = user.reducer(state, expectedActions[1]);
        expect(state).toEqual({
          login: [
            {
              params: [params],
              result: responseData(params),
              requesting: false,
              requested: true,
              error: null,
              updatedAt: 1
            }
          ]
        });

        selector = user.selectors(state).login(params);
        expect(selector).toEqual({
          error: null,
          params: [params],
          result: responseData(params),
          requesting: false,
          requested: true,
          updatedAt: 1
        });

        selectorResult = user.selectors(state).loginResult(params);
        expect(selectorResult).toEqual(responseData(params));

        store.clearActions();

        Date.now.restore();

        return store.dispatch(user.login(params));
      })
      .then(response => {
        const expectedActions = [
          { payload: [params], type: '@@redux-models/USER/LOGIN_START' },
          {
            payload: [params],
            type: '@@redux-models/USER/LOGIN_SUCCESS',
            meta: responseData(params)
          }
        ];

        sinon.stub(Date, 'now').callsFake(() => 1);

        expect(response).toEqual(responseData(params));

        state = user.reducer(state, expectedActions[0]);
        expect(state).toEqual({
          login: [
            {
              params: [params],
              result: responseData(params),
              requesting: true,
              requested: true,
              error: null,
              updatedAt: 1
            }
          ]
        });

        expect(user.selectors(state).login(params)).toEqual({
          params: [params],
          result: responseData(params),
          requesting: true,
          requested: true,
          error: null,
          updatedAt: 1
        });

        expect(user.selectors(state).loginResult(params)).toEqual(
          responseData(params)
        );

        state = user.reducer(state, expectedActions[1]);
        expect(state).toEqual({
          login: [
            {
              params: [params],
              result: responseData(params),
              requesting: false,
              requested: true,
              error: null,
              updatedAt: 1
            }
          ]
        });

        expect(user.selectors(state).login(params)).toEqual({
          params: [params],
          result: responseData(params),
          requesting: false,
          requested: true,
          error: null,
          updatedAt: 1
        });

        expect(user.selectors(state).loginResult(params)).toEqual(
          responseData(params)
        );

        Date.now.restore();
      });
  });

  it('create a model with async method and custom method reducer and selector', () => {
    const user = createModel({
      name: 'user',
      stateToModel: state => state,
      methods: {
        login: ({ password }) => {
          return Promise.resolve({ token: '12345' });
        }
      },
      reducers: {
        login: ({ START, SUCCESS, ERROR }) => (
          state = {},
          { type, meta, error }
        ) => {
          switch (type) {
            case START:
              return { requesting: true };
            case SUCCESS:
              return { requesting: false, result: meta };
            case ERROR:
              return { requesting: false, result: meta, error };
          }

          return state;
        }
      },
      selectors: {
        token() {
          return this.getModelState().login.result.token;
        }
      }
    });

    const expectedActions = [
      {
        payload: [{ password: '123' }],
        type: '@@redux-models/USER/LOGIN_START'
      },
      {
        meta: { token: '12345' },
        payload: [{ password: '123' }],
        type: '@@redux-models/USER/LOGIN_SUCCESS'
      }
    ];

    const store = mockStore();

    return store.dispatch(user.login({ password: '123' })).then(response => {
      expect(response).toEqual({ token: '12345' });
      expect(store.getActions()).toEqual(expectedActions);

      let state = {};
      let selector = user.selectors(state).login();
      expect(selector).toEqual(undefined);

      let selectorResult = user
        .selectors(state)
        .loginResult({ password: 'blabla2' });
      expect(selectorResult).toEqual(undefined);

      state = user.reducer(state, expectedActions[0]);
      expect(state).toEqual({ login: { requesting: true } });

      selector = user.selectors(state).login({ password: 'blabla3' });
      expect(selector).toEqual({ requesting: true });

      state = user.reducer(state, expectedActions[1]);
      expect(state).toEqual({
        login: { requesting: false, result: { token: '12345' } }
      });

      selector = user.selectors(state).login({ password: 'blabla3' });
      expect(selector).toEqual({
        requesting: false,
        result: { token: '12345' }
      });

      selector = user.selectors(state).loginResult({ password: 'blabla4' });
      expect(selector).toEqual({ token: '12345' });

      selector = user.selectors(state).token();
      expect(selector).toEqual('12345');
    });
  });

  it('create a model with model reducer', () => {
    const initialState = { started: false, count: 0, timerId: null };

    const timer = createModel({
      name: 'timer',
      stateToModel: state => state,
      methods: [
        function start(dispatch) {
          return setInterval(() => dispatch(this.increase()), 40);
        },

        'increase',

        function stop(timerId) {
          if (!timerId) {
            throw new Error('timerId required');
          }

          clearInterval(timerId);
        }
      ],
      reducer: ({ START, INCREASE, STOP }) => (
        state = initialState,
        action
      ) => {
        switch (action.type) {
          case START:
            return { ...state, started: true, timerId: action.meta };
          case INCREASE:
            return { ...state, count: state.count + 1 };
          case STOP:
            return { ...state, started: false, timerId: null };
        }

        return state;
      },
      selectors: {
        timerId() {
          return this.getModelState().model.timerId;
        }
      }
    });

    let state = {};
    const store = mockStore();
    const actions = store.getActions();

    store.dispatch(timer.start());

    state = timer.reducer(state, actions[0]);
    state = timer.reducer(state, actions[1]);

    return new Promise((resolve, reject) =>
      setTimeout(() => resolve(), 135)
    ).then(() => {
      const timerId = timer.selectors(state).timerId();

      store.dispatch(timer.stop(timerId));

      expect(actions).toEqual([
        { type: '@@redux-models/TIMER/START_START', payload: [] },
        {
          type: '@@redux-models/TIMER/START_SUCCESS',
          payload: [],
          meta: timerId
        },
        { type: '@@redux-models/TIMER/INCREASE_SUCCESS', payload: 'increase' },
        { type: '@@redux-models/TIMER/INCREASE_SUCCESS', payload: 'increase' },
        { type: '@@redux-models/TIMER/INCREASE_SUCCESS', payload: 'increase' },
        { type: '@@redux-models/TIMER/STOP_START', payload: [timerId] },
        {
          type: '@@redux-models/TIMER/STOP_SUCCESS',
          payload: [timerId],
          meta: null
        }
      ]);
    });
  });

  it('handle error', () => {
    const responseError = new Error('wrong password');

    const user = createModel({
      name: 'user',
      stateToModel: state => state,
      methods: {
        login: ({ password }) => {
          if (password === 'fail') {
            return Promise.reject(responseError);
          }

          return Promise.resolve({ token: '12345' });
        }
      }
    });

    let state = {};
    const store = mockStore();
    sinon.stub(Date, 'now').callsFake(() => 1);

    return store
      .dispatch(user.login({ password: '123' }))
      .then(response => {
        const expectedActions = [
          {
            payload: [{ password: '123' }],
            type: '@@redux-models/USER/LOGIN_START'
          },
          {
            payload: [{ password: '123' }],
            type: '@@redux-models/USER/LOGIN_SUCCESS',
            meta: { token: '12345' }
          }
        ];

        expect(response).toEqual({ token: '12345' });
        expect(store.getActions()).toEqual(expectedActions);

        state = user.reducer(state, expectedActions[0]);
        state = user.reducer(state, expectedActions[1]);

        store.clearActions();

        return store.dispatch(user.login({ password: 'fail' }));
      })
      .then(() => {
        throw new Error('should throw error');
      })
      .catch(error => {
        const expectedActions = [
          {
            payload: [{ password: 'fail' }],
            type: '@@redux-models/USER/LOGIN_START'
          },
          {
            payload: [{ password: 'fail' }],
            type: '@@redux-models/USER/LOGIN_ERROR',
            meta: responseError
          }
        ];

        expect(error.message).toEqual('wrong password');
        expect(store.getActions()).toEqual(expectedActions);

        let selector = user.selectors(state).login();
        expect(selector).toEqual({
          requested: false,
          requesting: false,
          result: null
        });

        selector = user.selectors(state).loginResult({ password: 'fail' });
        expect(selector).toEqual(null);

        state = user.reducer(state, expectedActions[0]);

        expect(state).toEqual({
          login: [
            {
              params: [{ password: '123' }],
              requested: true,
              requesting: false,
              result: { token: '12345' },
              error: null,
              updatedAt: 1
            },
            {
              params: [{ password: 'fail' }],
              requested: false,
              requesting: true,
              result: null,
              error: null,
              updatedAt: 1
            }
          ]
        });

        selector = user.selectors(state).login({ password: '123' });
        expect(selector).toEqual({
          params: [{ password: '123' }],
          requested: true,
          requesting: false,
          result: { token: '12345' },
          error: null,
          updatedAt: 1
        });

        selector = user.selectors(state).loginResult({ password: '123' });
        expect(selector).toEqual({ token: '12345' });

        state = user.reducer(state, expectedActions[1]);
        expect(state).toEqual({
          login: [
            {
              params: [{ password: '123' }],
              requested: true,
              requesting: false,
              result: { token: '12345' },
              error: null,
              updatedAt: 1
            },
            {
              params: [{ password: 'fail' }],
              requested: true,
              requesting: false,
              result: null,
              error: responseError,
              updatedAt: 1
            }
          ]
        });

        selector = user.selectors(state).login({ password: 'fail' });
        expect(selector).toEqual({
          params: [{ password: 'fail' }],
          requested: true,
          requesting: false,
          result: null,
          error: responseError,
          updatedAt: 1
        });

        Date.now.restore();

        selector = user.selectors(state).loginResult({ password: 'fail' });
        expect(selector).toEqual(null);
      });
  });

  it('tests reset method', () => {
    const responseError = new Error('wrong password');

    const user = createModel({
      name: 'user',
      stateToModel: state => state,
      methods: {
        login: ({ password }) => {
          if (password === 'fail') {
            return Promise.reject(responseError);
          }

          return Promise.resolve({ token: '12345' });
        },
        syncLogin: () => {
          return { token: '12345' };
        }
      }
    });

    let state = {};
    const store = mockStore();
    sinon.stub(Date, 'now').callsFake(() => 1);

    store.dispatch(user.syncLogin({ password: '123' }));
    store.dispatch(user.syncLoginReset());

    const expectedActions = store.getActions();

    state = user.reducer(state, expectedActions[0]);
    state = user.reducer(state, expectedActions[1]);

    expect(state).toEqual({
      login: [],
      syncLogin: [
        {
          params: [{ password: '123' }],
          requested: true,
          requesting: false,
          result: { token: '12345' },
          error: null,
          updatedAt: 1
        }
      ]
    });

    state = user.reducer(state, expectedActions[2]);

    expect(state).toEqual({
      login: [],
      syncLogin: []
    });

    store.clearActions();

    return store.dispatch(user.login({ password: '456' })).then(() => {
      store.dispatch(user.loginReset());

      const expectedActions = store.getActions();

      state = user.reducer(state, expectedActions[0]);
      state = user.reducer(state, expectedActions[1]);

      expect(state).toEqual({
        syncLogin: [],
        login: [
          {
            params: [{ password: '456' }],
            requested: true,
            requesting: false,
            result: { token: '12345' },
            error: null,
            updatedAt: 1
          }
        ]
      });

      state = user.reducer(state, expectedActions[2]);

      expect(state).toEqual({
        login: [],
        syncLogin: []
      });

      store.clearActions();
      Date.now.restore();
    });
  });
});
