::: header
# Shoutcast DNAS Server CDN Features {#shoutcast-dnas-server-cdn-features align="center"}

(Last Updated 08 Sep 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [1 Introduction](#Introduction)                                     |
| - [2 Configuration Options](#Configuration_Options)                   |
|   - [2.1 Relay Streams](#Relay_Streams)                               |
|     - [2.1.1 Master](#Master)                                         |
|     - [2.1.2 Slave](#Slave)                                           |
|     - [2.1.3 Intermediary](#Intermediary)                             |
|   - [2.2 Standard Streams](#Standard_Streams)                         |
+-----------------------------------------------------------------------+

[]{#Introduction}

## 1. Introduction

------------------------------------------------------------------------

When running the Shoutcast DNAS server in a CDN sitatuation, since
v2.4.1, there are some additional configuration options which can be
used to make it easier to automatically setup CDN master-slave (relay)
configurations and allow for streams not listed in the Shoutcast
Directory to still be able to make use of the DNAS+ functionality i.e.
the monetisation services when streaming.

The automatic setup provided is where a CDN slave is able to inherit the
authhash of the CDN master when it connects to the CDN master which can
make it quicker to create snd update multi-DNAS clusters without having
to manually configure all aspects of the DNAS configurations (though you
can still do that it you prefer to do so).

\

[]{#Configuration_Options}

## 2. Configuration Options [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

The configuration options work in-conjunction with the existing DNAS
server configuration options (unless otherwise stated) as detailed in
the [DNAS Server (section
4.0)](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2#Configuration_File)
documentation. It is assumed throughout that the DNAS server has been
correctly configured with all applicable passwords, etc as needed so
that the DNAS server will allow the YP server, source clients and
listener clients to connect as required.\
\

**cdn** : This is used to control whether the DNAS is running in CDN
mode or not and the specific level of functionality enabled *\[Default =
\<no value\>\]*

This has to be **one** of the following values when using the DNAS+ for
CDN service:

- **on**          →   This enables **opt-in** mode where all streams
  needing CDN behaviour have to be specifically configured to use it
- **always**   →   This enables **opt-out** mode where all streams will
  by default be able to work as CDN masters and CDN slaves
- **master**   →   This is a hybrid mode so all streams will by default
  be able to work as a CDN master but need to be manually configured to
  work as a CDN slave (if required)

<!-- -->

    Using 'cdn=master' is recommended for source DNAS in a master-slave
    configuration where it is not needed to have any CDN slave configured.

\
**\<MULTI\>** (one set for each stream configuration as required). See
[DNAS Server - section
4.0](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2#Configuration_File)
if unsure how to use \<MULTI\> options.\
\

    In all cases it is possible to override the behaviour (opt-in or opt-out)
    on a per-stream basis. If not specified then the global value is used.

\
\

**cdnmaster** : This controls if the stream is allowed to act as a CDN
master *\[Default = \<automatic\>\]*

If not specified then this is assumed as one of the following values
based on the \'**cdn**\' mode:

- **cdn=on**          →   cdnmaster=0
- **cdn=always**   →   cdnmaster=1
- **cdn=master**   →   cdnmaster=1

\

**cdnslave** : This controls if the stream is allowed to act as a CDN
slave *\[Default = \<automatic\>\]*

If not specified then this is assumed as one of the following values
based on the \'**cdn**\' mode:

- **cdn=on**          →   cdnslave=0
- **cdn=always**   →   cdnslave=1
- **cdn=master**   →   cdnslave=0

\

The Server Admin Summary page (**admin.cgi?sid=0**) will show the CDN
mode that each of the streams have been configured. Additionally the
Admin Summary page (**admin.cgi?sid=x** where **x** is the stream
number) will indicate if a CDN slave is connected to the stream.

\

[]{#Relay_Streams}

## 2.1 Relay Streams [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

A key feature of the CDN functionality is the ability to make it simpler
to create master-slave relay setups and so allow for easier multiple
DNAS clustering if such functionality is required for the stream(s). If
not required see [Standard Streams](#Standard_Streams).

By configuring the DNAS for a stream as master(s) and slave(s) as needed
and following the requirements detailed in the following sections, it is
possible to have a CDN slave automatically obtain the details needed
(via authhash inheritence) to then be listed in the Shoutcast Directory
or to act as an intermediary DNAS server which in-turn is able to
provide authhash inheritence to CDN slaves connected to it and so on.

\

[]{#Master}

## 2.1.1 Master [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When a stream is configured as a CDN master, it will only allow authhash
inheritence for a CDN slave if the connecting CDN slave is correctly
reported as one and that the address of the slave is in the [Reserved
List (section
4.11)](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2#Reserved_List).

This requirement of the CDN slave being in the Reserved List is force
enabled (equivalent of setting \'**riponly=1**\' or
\'**streamriponly=1**\') when enabling CDN mode and is done to ensure
that only allowed CDN slave connections can join the stream(s) on the
CDN master.

\

[]{#Slave}

## 2.1.2 Slave [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When a stream is configured as a CDN slave, it will only be allowed to
connect to a CDN master if the master has been correctly configured to
allow connections from the host / IP address reported by the CDN slave
on connection.

If the master is not configured as a valid CDN master then the CDN slave
will not inherit the authhash of the CDN master and it also may not be
allowed to connect as relay (due to the [Reserved List (section
4.11)](http://wiki.shoutcast.com/wiki/SHOUTcast_DNAS_Server_2#Reserved_List)
requirement).

\

[]{#Intermediary}

## 2.1.3 Intermediary [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When a stream is configured as a CDN intermediary, it will work as both
a CDN master and as a CDN slave. This is helpful if wanting to have
intermediary layers in a CDN setup whilst still being able to have
authhash inheritence to ensure that all of the public facing CDN slaves
provide the correct stream details.

\

[]{#Standard_Streams}

## 2.2 Standard Streams [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

A standard stream is one where you are not needing to have a
master-slave pairing (when there is no relaying required) or you do not
require authhash inheritence support but still require the monetisation
functionality to work.

For such setups, ensuring you have \'**cdn=on**\' specified in the DNAS
server configuration file is all that is needed so the streams are
handled in the **opt-in** mode which will prevent unwanted master-slave
relay configurations whilst still allowing all other functionality to
work.

This mode does not prevent you from configuring other streams on the
same DNAS server to be able to work as a CDN master or CDN slave which
requires specifying the \'**cdnmaster**\' and / or \'**cdnslave**\'
configuration options as required for the setup

\
