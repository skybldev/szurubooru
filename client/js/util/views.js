'use strict';

require('../util/polyfill.js');
const underscore = require('underscore');
const tags = require('../tags.js');
const events = require('../events.js');
const domParser = new DOMParser();
const misc = require('./misc.js');

function _makeLabel(options, attrs) {
    if (!options.text) {
        return '';
    }
    if (!attrs) {
        attrs = {};
    }
    attrs.for = options.id;
    return makeNonVoidElement('label', attrs, options.text);
}

function makeRelativeTime(time) {
    return makeNonVoidElement(
        'time',
        {datetime: time, title: time},
        misc.formatRelativeTime(time));
}

function makeThumbnail(url) {
    return makeNonVoidElement(
        'span',
        {
            class: 'thumbnail',
            style: 'background-image: url(\'{0}\')'.format(url)
        },
        makeVoidElement('img', {alt: 'thumbnail', src: url}));
}

function makeRadio(options) {
    return makeVoidElement(
            'input',
            {
                id: options.id,
                name: options.name,
                value: options.value,
                type: 'radio',
                checked: options.selectedValue === options.value,
                required: options.required,
            }) +
        _makeLabel(options, {class: 'radio'});
}

function makeCheckbox(options) {
    return makeVoidElement(
            'input',
            {
                id: options.id,
                name: options.name,
                value: options.value,
                type: 'checkbox',
                checked: options.checked !== undefined ?
                    options.checked : false,
                required: options.required,
            }) +
        _makeLabel(options, {class: 'checkbox'});
}

function makeSelect(options) {
    return _makeLabel(options) +
        makeNonVoidElement(
            'select',
            {id: options.id, name: options.name},
            Object.keys(options.keyValues).map(key => {
                return makeNonVoidElement(
                    'option',
                    {value: key, selected: key === options.selectedKey},
                    options.keyValues[key]);
            }).join(''));
}

function makeInput(options) {
    return _makeLabel(options) +
        makeVoidElement(
            'input', {
                type: options.inputType,
                name: options.name,
                id: options.id,
                value: options.value || '',
                required: options.required,
                pattern: options.pattern,
                placeholder: options.placeholder,
            });
}

function makeTextInput(options) {
    options.inputType = 'text';
    return makeInput(options);
}

function makePasswordInput(options) {
    options.inputType = 'password';
    return makeInput(options);
}

function makeEmailInput(options) {
    options.inputType = 'email';
    return makeInput(options);
}

function makeColorInput(options) {
    const textInput = makeVoidElement(
        'input', {
            type: 'text',
            value: options.value || '',
            required: options.required,
            style: 'color: ' + options.value,
            disabled: true,
        });
    const colorInput = makeVoidElement(
        'input', {
            type: 'color',
            value: options.value || '',
        });
    return makeNonVoidElement(
        'label', {class: 'color'}, colorInput + textInput);
}

function makeTagLink(name) {
    const tagExport = tags.getExport();
    let category = null;
    try {
        category = tagExport.tags[name].category;
    } catch (e) {
        category = 'unknown';
    }
    return makeNonVoidElement('a', {
        'href': '/tag/' + name,
        'class': 'tag-' + category,
    }, name);
}

function makeFlexboxAlign(options) {
    return Array.from(misc.range(20))
        .map(() => '<li class="flexbox-dummy"></li>').join('');
}

function _messageHandler(target, message, className) {
    if (!message) {
        message = 'Unknown message';
    }
    const messagesHolder = target.querySelector('.messages');
    if (!messagesHolder) {
        alert(message);
        return;
    }
    /* TODO: animate this */
    const node = document.createElement('div');
    node.innerHTML = message.replace(/\n/g, '<br/>');
    node.classList.add('message');
    node.classList.add(className);
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper');
    wrapper.appendChild(node);
    messagesHolder.appendChild(wrapper);
}

function _serializeElement(name, attributes) {
    return [name]
        .concat(Object.keys(attributes).map(key => {
            if (attributes[key] === true) {
                return key;
            } else if (attributes[key] === false ||
                    attributes[key] === undefined) {
                return '';
            }
            return '{0}="{1}"'.format(key, attributes[key]);
        }))
        .join(' ');
}

function makeNonVoidElement(name, attributes, content) {
    return '<{0}>{1}</{2}>'.format(
        _serializeElement(name, attributes), content, name);
}

function makeVoidElement(name, attributes) {
    return '<{0}/>'.format(_serializeElement(name, attributes));
}

function listenToMessages(target) {
    events.unlisten(events.Success);
    events.unlisten(events.Error);
    events.unlisten(events.Info);
    events.listen(
        events.Success, msg => { _messageHandler(target, msg, 'success'); });
    events.listen(
        events.Error, msg => { _messageHandler(target, msg, 'error'); });
    events.listen(
        events.Info, msg => { _messageHandler(target, msg, 'info'); });
}

function clearMessages(target) {
    const messagesHolder = target.querySelector('.messages');
    /* TODO: animate that */
    while (messagesHolder.lastChild) {
        messagesHolder.removeChild(messagesHolder.lastChild);
    }
}

function htmlToDom(html) {
    const parsed = domParser.parseFromString(html, 'text/html').body;
    return parsed.childNodes.length > 1 ?
        parsed.childNodes :
        parsed.firstChild;
}

function getTemplate(templatePath) {
    if (!(templatePath in templates)) {
        console.error('Missing template: ' + templatePath);
        return null;
    }
    const templateText = templates[templatePath].trim();
    const templateFactory = underscore.template(templateText);
    return ctx => {
        if (!ctx) {
            ctx = {};
        }
        underscore.extend(ctx, {
            makeRelativeTime: makeRelativeTime,
            makeThumbnail: makeThumbnail,
            makeRadio: makeRadio,
            makeCheckbox: makeCheckbox,
            makeSelect: makeSelect,
            makeInput: makeInput,
            makeTextInput: makeTextInput,
            makePasswordInput: makePasswordInput,
            makeEmailInput: makeEmailInput,
            makeColorInput: makeColorInput,
            makeTagLink: makeTagLink,
            makeFlexboxAlign: makeFlexboxAlign,
        });
        return htmlToDom(templateFactory(ctx));
    };
}

function decorateValidator(form) {
    // postpone showing form fields validity until user actually tries
    // to submit it (seeing red/green form w/o doing anything breaks POLA)
    let submitButton = form.querySelector('.buttons input');
    if (!submitButton) {
        submitButton = form.querySelector('input[type=submit]');
    }
    if (submitButton) {
        submitButton.addEventListener('click', e => {
            form.classList.add('show-validation');
        });
    }
    form.addEventListener('submit', e => {
        form.classList.remove('show-validation');
    });
}

function disableForm(form) {
    for (let input of form.querySelectorAll('input')) {
        input.disabled = true;
    }
}

function enableForm(form) {
    for (let input of form.querySelectorAll('input')) {
        input.disabled = false;
    }
}

function showView(target, source) {
    while (target.lastChild) {
        target.removeChild(target.lastChild);
    }
    if (source instanceof NodeList) {
        for (let child of source) {
            target.appendChild(child);
        }
    } else if (source instanceof Node) {
        target.appendChild(source);
    } else {
        console.error('Invalid view source', source);
    }
}

function scrollToHash() {
    window.setTimeout(() => {
        if (!window.location.hash) {
            return;
        }
        const el = document.getElementById(
            window.location.hash.replace(/#/, ''));
        if (el) {
            el.scrollIntoView();
        }
    }, 10);
}

document.addEventListener('input', e => {
    if (e.target.getAttribute('type').toLowerCase() === 'color') {
        const textInput = e.target.parentNode.querySelector('input[type=text]');
        textInput.style.color = e.target.value;
        textInput.value = e.target.value;
    }
});

module.exports = {
    htmlToDom: htmlToDom,
    getTemplate: getTemplate,
    showView: showView,
    enableForm: enableForm,
    disableForm: disableForm,
    listenToMessages: listenToMessages,
    clearMessages: clearMessages,
    decorateValidator: decorateValidator,
    makeVoidElement: makeVoidElement,
    makeNonVoidElement: makeNonVoidElement,
    scrollToHash: scrollToHash,
};
