import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import ChannelSelector from './ChannelSelector';
import Channel from '../domain/Channel';
import '@testing-library/jest-dom';

test('it only renders the unpatched option by default', () => {
    const root = document.createElement('div')
    const { getByText, getAllByRole } = render(<ChannelSelector />, {
        container: document.body.appendChild(root)
    })
    expect(getByText('(unpatched)')).toBeInTheDocument()
    expect(getAllByRole('option')).toHaveLength(1)
})

test('it displays labels correctly', () => {
    const root = document.createElement('div')
    const channels = [
        new Channel("1", "Channel One"),
        new Channel("2", "Channel Two"),
        new Channel("3"),
        new Channel("foobar"),
        new Channel("baz", "Channel 42"),
    ]
    const { getByText, getAllByRole } = render(<ChannelSelector channels={channels} />, {
        container: document.body.appendChild(root)
    })

    const el1 = getByText("1 Channel One") as HTMLOptionElement
    expect(el1).toBeInTheDocument()
    expect((el1 as HTMLOptionElement).value).toBe("1")

    const el2 = getByText("2 Channel Two") as HTMLOptionElement
    expect(el2).toBeInTheDocument()
    expect((el2 as HTMLOptionElement).value).toBe("2")

    const el3 = getByText("3 Channel 3") as HTMLOptionElement
    expect(el3).toBeInTheDocument()
    expect((el3 as HTMLOptionElement).value).toBe("3")

    const el4 = getByText("foobar Channel foobar") as HTMLOptionElement
    expect(el4).toBeInTheDocument()
    expect((el4 as HTMLOptionElement).value).toBe("foobar")

    const el5 = getByText("baz Channel 42") as HTMLOptionElement
    expect(el5).toBeInTheDocument()
    expect((el5 as HTMLOptionElement).value).toBe("baz")

    expect(getAllByRole('option')).toHaveLength(6) // one more for the (unpatched) option
})

test('it calls onChange with the right value', () => {
    const root = document.createElement('div')
    const channels = [
        new Channel("1", "Channel One"),
        new Channel("2", "Channel Two"),
        new Channel("3"),
        new Channel("foobar"),
        new Channel("baz", "Channel 42"),
    ]
    let lastSeenValue
    const { getByText, getByRole } = render(<ChannelSelector channels={channels} onChange={val => lastSeenValue = val} />, {
        container: document.body.appendChild(root)
    })

    const select = getByRole("listbox")

    const el1 = getByText("1 Channel One") as HTMLOptionElement
    fireEvent.change(select, { target: { value: (el1 as HTMLOptionElement).value } })
    expect(lastSeenValue).toEqual(["1"])

    const el2 = getByText("2 Channel Two") as HTMLOptionElement
    fireEvent.change(select, { target: { value: (el2 as HTMLOptionElement).value } })
    expect(lastSeenValue).toEqual(["2"])

    const el3 = getByText("3 Channel 3") as HTMLOptionElement
    fireEvent.change(select, { target: { value: (el3 as HTMLOptionElement).value } })
    expect(lastSeenValue).toEqual(["3"])

    const el4 = getByText("foobar Channel foobar") as HTMLOptionElement
    fireEvent.change(select, { target: { value: (el4 as HTMLOptionElement).value } })
    expect(lastSeenValue).toEqual(["foobar"])

    const el5 = getByText("baz Channel 42") as HTMLOptionElement
    fireEvent.change(select, { target: { value: (el5 as HTMLOptionElement).value } })
    expect(lastSeenValue).toEqual(["baz"])

    const el6 = getByText("(unpatched)") as HTMLOptionElement
    fireEvent.change(select, { target: { value: (el6 as HTMLOptionElement).value } })
    expect(lastSeenValue).toEqual([])
})

test('it selects (unpatched) by default', () => {
    const root = document.createElement('div')
    const channels = [
        new Channel("1", "Channel One"),
        new Channel("2", "Channel Two"),
        new Channel("3", "Channel Three"),
    ]
    const { getByRole } = render(<ChannelSelector channels={channels} />, {
        container: document.body.appendChild(root)
    })

    const select = getByRole("listbox")
    expect(select).toHaveValue([])
})
test('it shows fifteen rows for scrolling long input lists', () => {
    const root = document.createElement('div')
    const { getByRole } = render(<ChannelSelector />, {
        container: document.body.appendChild(root)
    })

    expect(getByRole("listbox")).toHaveAttribute("size", "15")
})
test('it shows the key if a selected channel does not exist', () => {
    const root = document.createElement('div')
    const channels = [
        new Channel("1", "Channel One"),
        new Channel("2", "Channel Two"),
        new Channel("3", "Channel Three"),
    ]
    const { getByText, getByRole } = render(<ChannelSelector channels={channels} value="4" />, {
        container: document.body.appendChild(root)
    })

    const select = getByRole("listbox")

    expect(select).toHaveValue(["4"])
    const el = getByText("4 Channel 4")
    expect(el).toBeInTheDocument()
})

test('it displays multiple selected channels', () => {
    const root = document.createElement('div')
    const channels = [
        new Channel("1", "Channel One"),
        new Channel("2", "Channel Two"),
        new Channel("3", "Channel Three"),
    ]
    const { getByRole } = render(<ChannelSelector channels={channels} value={["1", "3"]} />, {
        container: document.body.appendChild(root)
    })

    expect(getByRole("listbox")).toHaveValue(["1", "3"])
})
