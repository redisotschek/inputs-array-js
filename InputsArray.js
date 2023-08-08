
let activeEffect = null;

function effect(eff) {
  activeEffect = eff; // Сохраняем последний эффект
  if (activeEffect) activeEffect(); // Выполняем его
  activeEffect = null; // Сбрасываем
}

const targetMap = new WeakMap(); // targetMap хранит эффекты
function track(target, key) {
  // Отслеживаем эффект
  let depsMap = targetMap.get(target); // Получаем текущий depsMap для данного target
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map())); // Создаем мапу, если её нет
  }
  let dep = depsMap.get(key); // Получаем эффекты для ключа
  if (!dep) {
    // Эффектов нет
    depsMap.set(key, (dep = new Set())); // Создаем новую мапу для эффектов
  }
  if (activeEffect && !dep.has(activeEffect)) {
    // Если есть текущий эффект, добавляем его в мапу
    dep.add(activeEffect);
  }
}
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  let dep = depsMap.get(key);
  if (dep) {
    dep.forEach(effect => {
      // выполняем все эффекты для ключа
      if (effect) effect();
    });
  }
}

function reactive(target) {
  const handler = {
    get(target, key, receiver) {
      let result = Reflect.get(target, key, receiver);
      track(target, key); // Следим за свойством и сохраняем эффекты
      return result;
    },
    set(target, key, value, receiver) {
      let oldValue = target[key];
      let result = Reflect.set(target, key, value, receiver);
      if (result && JSON.stringify(oldValue) !== JSON.stringify(value)) {
        trigger(target, key); // Вызываем эффекты для свойства
      }
      return result;
    }
  };
  return new Proxy(target, handler);
}

class InputsArray {
  emptyInput;
  state = reactive({
    inputStrings: [],
    inputsArray: [],
  });
  currentFocusIndex = 0;
  container = document.getElementById('inputs-container');
  resultsContainer = document.getElementById('result');
  constructor(inputStrings) {
    const strings = inputStrings && inputStrings.length > 0 ? inputStrings : [''];
    // set values создаст эффект для создания инпутов и добавления их в DOM
    this.setValues(strings);
  }

  createReactiveInputs() {
    // Создаем инпуты и сохраняем их в массиве
    this.state.inputsArray = this.state.inputStrings.map((value, index) => {
      const input = { value, ref: this.createInput(value, index) };
      return input;
    });
    // рендерим
    this.render();
  }

  focusEmptyInput() {
    const ref = document.getElementById('empty');
    this.currentFocusIndex = this.state.inputsArray.length;
    return ref.focus();
  }

  focusElement(index) {
    const length = this.state.inputsArray.length;
    let newIndex = index;
    if (index === 'empty' || index === length) {
      return this.focusEmptyInput();
    }
    if (newIndex > length) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      this.focusEmptyInput();
    }
    const input = this.state.inputsArray[newIndex];
    if (input) {
      input.ref.focus();
    }
    this.currentFocusIndex = newIndex;
  }

  createInput(value = '', index) {
    const input = document.createElement('input');
    input.value = value;
    input.setAttribute('key', value+index);
    // Даём пустому инпуту айди, чтобы его отслеживать
    if (index === 'empty') {
      input.setAttribute('id', value+index);
    }
    input.addEventListener('input', this.handleInput.bind(this));
    input.addEventListener('keydown', this.handleKeyDown.bind(this));
    input.addEventListener('focus', this.handleFocus.bind(this));
    return input;
  }

  setValues(values) {
    // Вызываем set и назначаем эффект
    this.state.inputStrings = values;
    effect(this.createReactiveInputs.bind(this));
  }

  setValueTo(index, value) {
    // грязными ручками меняем значения, чтобы не вызывать сеттеры на весь массив лишний раз
    this.state.inputStrings[index] = value;
    this.state.inputsArray[index].value = value;
    this.render();
  }

  addNewValue(value) {
    // Добавляем новое значение в массив, ему понадобится свой инпут, поэтому вызываем эффект
    this.state.inputStrings.push(value);
    effect(this.createReactiveInputs.bind(this));
  }

  render() {
    // тут всё понятно
    this.container.innerHTML = '';
    this.state.inputsArray.forEach(input => {
      this.container.appendChild(input.ref);
    });
    this.container.appendChild(this.createInput('', 'empty'));
    const inputArrayValues = this.state.inputsArray.map(input => input.value);
    this.resultsContainer.innerHTML = `<p>[${inputArrayValues.join(', ')}]</p>`
    this.focusElement(this.currentFocusIndex);
  }

  // тут UI хендлеры

  handleKeyDown(event) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      this.focusElement(event.key === 'ArrowUp' ? this.currentFocusIndex - 1 : this.currentFocusIndex + 1);
    } else if (event.key === 'Enter') {
      this.focusElement(this.currentFocusIndex + 1);
    } else if (event.key === 'Delete') {
      console.log('Delete:', this.currentFocusIndex)
      this.deleteActiveInput();
    }
  }

  handleFocus(event) {
    const input = event.target;
    const key = input.getAttribute('key');
    let index = this.state.inputsArray.findIndex(input => input.ref.getAttribute('key') === key);
    if (index === -1) {
      index = 'empty';
    }
    this.focusElement(index);
  }

  deleteActiveInput() {
    if (this.state.inputsArray.length <= 1) return;
    this.state.inputStrings.splice(this.currentFocusIndex, 1);
    this.setValues(this.state.inputStrings);
  }

  handleInput(event) {
    console.log('Input:', event.target.value);
    const id = event.target.getAttribute('id');
    let key = event.target.getAttribute('key');
    const value = event.target.value;
    if (id === 'empty') {
      const oldSize = this.state.inputsArray.length;
      key = value + (oldSize - 1);
      event.target.setAttribute('key', key);
      event.target.setAttribute('id', '');
      this.addNewValue(value);
      return effect(() => {
        this.focusElement(oldSize);
      });
    } else {
      const index = this.state.inputsArray.findIndex(input => input.ref.getAttribute('key') === key);
      this.setValueTo(index, value);
    }
  }
}

const inputStrings = ["Hello", "World"];
const inputsArray = new InputsArray(inputStrings);

