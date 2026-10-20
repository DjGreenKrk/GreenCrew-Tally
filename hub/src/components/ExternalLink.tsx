import React from 'react'
import { Link } from "@material-ui/core"

function ExternalLink(props: React.ComponentProps<typeof Link>) {
    const myProps = {...props, ...{
        target: "_blank",
        rel: "noreferrer noopener",
    }}

    return (<Link {...myProps} />)
}

export default ExternalLink
